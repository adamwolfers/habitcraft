// Package habitcraft is the HabitCraft server as an embeddable Go package. An
// application that wants habit tracking mounts Handler on its own mux; the
// standalone binary in cmd/habitcraft does the same thing with nothing else
// around it.
//
// The HTTP interface is generated from shared/api-spec/openapi.yaml (package
// api). Every request is validated against that spec before a handler runs,
// and every handler can return only the responses the spec documents.
package habitcraft

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adamwolfers/habitcraft/server/internal/api"
	"github.com/adamwolfers/habitcraft/server/internal/validation"
)

// Config is what the server needs from the application running it.
type Config struct {
	// DB is the HabitCraft database, already migrated by Migrate.
	DB *pgxpool.Pool
	// JWTSecret signs and verifies the access and refresh tokens. It must be
	// at least 32 bytes. Use the Node backend's JWT_SECRET while both run,
	// so a session started on one is honoured by the other.
	JWTSecret []byte
	// InsecureCookies drops the Secure attribute from the auth cookies and
	// relaxes SameSite from Strict to Lax, for local development over plain
	// HTTP. Never set it in production.
	InsecureCookies bool
	// TrustedProxyHops is how many reverse proxies stand between clients and
	// this server, each appending to X-Forwarded-For. The rate limits key on
	// the client's address, and only the entries those proxies appended can
	// be believed: count one too many and a caller picks their own address
	// per request; one too few and every client shares the proxy's. The zero
	// value ignores X-Forwarded-For, which is right with no proxy in front.
	TrustedProxyHops int
	// DisableRateLimiting turns off the limits on register, login, refresh,
	// change password and delete account, for a test suite that makes many
	// requests from one address. Never set it in production.
	DisableRateLimiting bool
	// Logger defaults to slog.Default().
	Logger *slog.Logger
	// OnCompletion, if set, is called once for each day checked off,
	// unchecked, or whose note changed, after the change is committed. It
	// runs on the request's goroutine before the response is written, so
	// slow work belongs on a goroutine of the host's; the response is the same
	// whatever it does, and a panic in it is logged and recovered. Its context
	// carries the request's values but is not cancelled with it.
	//
	// Delivery is at most once: a process that dies between the commit and
	// the call loses the event. Deleting a habit or an account removes its
	// completions without an event for each.
	OnCompletion func(context.Context, CompletionEvent)
}

// pinger is the slice of the database that the health check needs.
type pinger interface {
	Ping(ctx context.Context) error
}

// Server is HabitCraft, ready to mount on an application's mux. Its only
// method is Handler.
type Server struct {
	s *server
}

// server implements every operation in the spec. The generated interface's
// methods are on it rather than on Server, so they are not part of the API an
// embedding application sees.
type server struct {
	db              pinger
	store           store
	tokens          tokens
	insecureCookies bool
	logger          *slog.Logger
	onCompletion    func(context.Context, CompletionEvent)

	trustedProxyHops int
	rateLimitingOff  bool
	limiter          *limiter
}

var _ api.StrictServerInterface = (*server)(nil)

// New returns a server for cfg. It does not touch the database.
func New(cfg Config) (*Server, error) {
	if cfg.DB == nil {
		return nil, errors.New("habitcraft: Config.DB is required")
	}
	if len(cfg.JWTSecret) < minSecretLength {
		return nil, fmt.Errorf("habitcraft: Config.JWTSecret must be at least %d bytes", minSecretLength)
	}
	if cfg.TrustedProxyHops < 0 {
		return nil, errNegativeHops
	}
	return &Server{s: newServer(cfg.DB, pgStore{pool: cfg.DB}, cfg)}, nil
}

// newServer takes everything but the database from cfg, so tests can fake it.
func newServer(db pinger, st store, cfg Config) *server {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &server{
		db:              db,
		store:           st,
		tokens:          tokens{secret: cfg.JWTSecret, now: time.Now},
		insecureCookies: cfg.InsecureCookies,
		logger:          logger,
		onCompletion:    cfg.OnCompletion,

		trustedProxyHops: cfg.TrustedProxyHops,
		rateLimitingOff:  cfg.DisableRateLimiting,
		limiter:          newLimiter(),
	}
}

// Handler serves the whole API. Its paths are absolute, as the spec writes
// them (/health, /api/v1/...), so an application mounting it under a prefix
// strips that prefix first.
//
// A request's body is read first, up to maxBodyBytes. It then passes
// authentication, rate limiting and validation, in that order, and reaches its
// handler. Authentication goes before validation so an anonymous caller gets a
// 401 before any field is checked, and never sees per-field errors.
func (s *Server) Handler() (http.Handler, error) {
	return s.s.handler()
}

func (s *server) handler() (http.Handler, error) {
	spec, err := api.GetSwagger()
	if err != nil {
		return nil, fmt.Errorf("habitcraft: loading the embedded spec: %w", err)
	}
	authenticate, err := s.authentication(spec)
	if err != nil {
		return nil, fmt.Errorf("habitcraft: %w", err)
	}
	limit, err := s.rateLimiting(spec)
	if err != nil {
		return nil, err
	}
	validate, err := validation.Middleware(spec)
	if err != nil {
		return nil, fmt.Errorf("habitcraft: %w", err)
	}

	strict := api.NewStrictHandlerWithOptions(s, []api.StrictMiddlewareFunc{withRequest}, api.StrictHTTPServerOptions{
		// Validation has already passed, so a body that will not decode is a
		// fault here, not in the request.
		RequestErrorHandlerFunc:  s.serverError,
		ResponseErrorHandlerFunc: s.serverError,
	})
	routes := api.HandlerWithOptions(strict, api.StdHTTPServerOptions{
		BaseRouter:       http.NewServeMux(),
		ErrorHandlerFunc: s.badParameter,
	})
	return readBody(authenticate(limit(validate(routes)))), nil
}

// maxBodyBytes caps a request body. The largest valid one is a few KB (the
// spec's longest strings are 500 characters); this is Express's json()
// default, 100kb, so the Node backend refuses the same bodies.
const maxBodyBytes = 100 << 10

type bodyKey struct{}

// readBody reads the request body, refusing one over maxBodyBytes with a
// 413 before anything else sees it, and keeps a copy in the context. The
// generated handlers decode it into structs, where a field sent as null and a
// field not sent look alike; bodyHas tells them apart.
func readBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ContentLength > maxBodyBytes {
			writeJSON(w, http.StatusRequestEntityTooLarge, api.Error{Error: "Request body too large"})
			return
		}
		if r.Body == nil || r.Body == http.NoBody {
			next.ServeHTTP(w, r)
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBodyBytes))
		if tooLarge := (*http.MaxBytesError)(nil); errors.As(err, &tooLarge) {
			writeJSON(w, http.StatusRequestEntityTooLarge, api.Error{Error: "Request body too large"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusBadRequest, api.Error{Error: "Could not read the request body"})
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), bodyKey{}, body)))
	})
}

// bodyHas reports whether the request body is a JSON object with field in it,
// whatever its value, null included.
func bodyHas(ctx context.Context, field string) bool {
	body, _ := ctx.Value(bodyKey{}).([]byte)
	var fields map[string]json.RawMessage
	if json.Unmarshal(body, &fields) != nil {
		return false
	}
	_, ok := fields[field]
	return ok
}

type requestKey struct{}

// withRequest hands the strict handlers the raw request, for the cookies the
// spec does not model as parameters (refresh and logout read refreshToken).
func withRequest(next api.StrictHandlerFunc, _ string) api.StrictHandlerFunc {
	return func(ctx context.Context, w http.ResponseWriter, r *http.Request, request any) (any, error) {
		return next(context.WithValue(ctx, requestKey{}, r), w, r, request)
	}
}

// requestFrom returns the request withRequest stored in ctx.
func requestFrom(ctx context.Context) *http.Request {
	r, _ := ctx.Value(requestKey{}).(*http.Request)
	return r
}

// serverError answers a handler's error.
func (s *server) serverError(w http.ResponseWriter, r *http.Request, err error) {
	s.logger.ErrorContext(r.Context(), "request failed", "method", r.Method, "path", r.URL.Path, "err", err)
	writeJSON(w, http.StatusInternalServerError, api.Error{Error: "Internal server error"})
}

// badParameter answers a path or query parameter the generated router could
// not bind. Validation rejects those first, so this is a backstop.
func (s *server) badParameter(w http.ResponseWriter, _ *http.Request, err error) {
	writeJSON(w, http.StatusBadRequest, api.Error{Error: err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
