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

	"github.com/adamwolfers/habitcraft/server/api"
	"github.com/adamwolfers/habitcraft/server/internal/validation"
)

// Config is what the server needs from the application running it.
type Config struct {
	// DB is the HabitCraft database, already migrated with db/migrations.
	DB *pgxpool.Pool
	// JWTSecret signs and verifies the access and refresh tokens. It must be
	// at least 32 bytes. Use the Node backend's JWT_SECRET while both run,
	// so a session started on one is honoured by the other.
	JWTSecret []byte
	// InsecureCookies drops the Secure attribute from the auth cookies and
	// relaxes SameSite from Strict to Lax, for local development over plain
	// HTTP. Never set it in production.
	InsecureCookies bool
	// Logger defaults to slog.Default().
	Logger *slog.Logger
}

// pinger is the slice of the database that the health check needs.
type pinger interface {
	Ping(ctx context.Context) error
}

// Server implements every operation in the spec.
type Server struct {
	db              pinger
	store           store
	tokens          tokens
	insecureCookies bool
	logger          *slog.Logger
}

var _ api.StrictServerInterface = (*Server)(nil)

// New returns a server for cfg. It does not touch the database.
func New(cfg Config) (*Server, error) {
	if cfg.DB == nil {
		return nil, errors.New("habitcraft: Config.DB is required")
	}
	if len(cfg.JWTSecret) < minSecretLength {
		return nil, fmt.Errorf("habitcraft: Config.JWTSecret must be at least %d bytes", minSecretLength)
	}
	return newServer(cfg.DB, pgStore{pool: cfg.DB}, cfg), nil
}

// newServer takes everything but the database from cfg, so tests can fake it.
func newServer(db pinger, st store, cfg Config) *Server {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &Server{
		db:              db,
		store:           st,
		tokens:          tokens{secret: cfg.JWTSecret, now: time.Now},
		insecureCookies: cfg.InsecureCookies,
		logger:          logger,
	}
}

// Handler serves the whole API. Its paths are absolute, as the spec writes
// them (/health, /api/v1/...), so an application mounting it under a prefix
// strips that prefix first.
//
// A request passes authentication, then validation, then reaches its handler.
// Authentication goes first so an anonymous caller gets a 401 before any field
// is checked, and never sees per-field errors.
func (s *Server) Handler() (http.Handler, error) {
	spec, err := api.GetSwagger()
	if err != nil {
		return nil, fmt.Errorf("habitcraft: loading the embedded spec: %w", err)
	}
	authenticate, err := s.authentication(spec)
	if err != nil {
		return nil, fmt.Errorf("habitcraft: %w", err)
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
	return authenticate(validate(keepBody(routes))), nil
}

type bodyKey struct{}

// keepBody keeps a copy of the request body in the context. The generated
// handlers decode it into structs, where a field sent as null and a field not
// sent look alike; bodyHas tells them apart.
func keepBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body == nil || r.Body == http.NoBody {
			next.ServeHTTP(w, r)
			return
		}
		body, err := io.ReadAll(r.Body)
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
func (s *Server) serverError(w http.ResponseWriter, r *http.Request, err error) {
	s.logger.ErrorContext(r.Context(), "request failed", "method", r.Method, "path", r.URL.Path, "err", err)
	writeJSON(w, http.StatusInternalServerError, api.Error{Error: "Internal server error"})
}

// badParameter answers a path or query parameter the generated router could
// not bind. Validation rejects those first, so this is a backstop.
func (s *Server) badParameter(w http.ResponseWriter, _ *http.Request, err error) {
	writeJSON(w, http.StatusBadRequest, api.Error{Error: err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
