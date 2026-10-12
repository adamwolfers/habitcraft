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
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adamwolfers/habitcraft/server/api"
	"github.com/adamwolfers/habitcraft/server/internal/validation"
)

// Config is what the server needs from the application running it.
type Config struct {
	// DB is the HabitCraft database, already migrated with db/migrations.
	DB *pgxpool.Pool
	// Logger defaults to slog.Default().
	Logger *slog.Logger
}

// pinger is the slice of the database that the health check needs.
type pinger interface {
	Ping(ctx context.Context) error
}

// Server implements every operation in the spec.
type Server struct {
	db     pinger
	logger *slog.Logger
}

var _ api.StrictServerInterface = (*Server)(nil)

// New returns a server for cfg. It does not touch the database.
func New(cfg Config) (*Server, error) {
	if cfg.DB == nil {
		return nil, errors.New("habitcraft: Config.DB is required")
	}
	return newServer(cfg.DB, cfg.Logger), nil
}

func newServer(db pinger, logger *slog.Logger) *Server {
	if logger == nil {
		logger = slog.Default()
	}
	return &Server{db: db, logger: logger}
}

// Handler serves the whole API. Its paths are absolute, as the spec writes
// them (/health, /api/v1/...), so an application mounting it under a prefix
// strips that prefix first.
func (s *Server) Handler() (http.Handler, error) {
	spec, err := api.GetSwagger()
	if err != nil {
		return nil, fmt.Errorf("habitcraft: loading the embedded spec: %w", err)
	}
	validate, err := validation.Middleware(spec)
	if err != nil {
		return nil, fmt.Errorf("habitcraft: %w", err)
	}

	strict := api.NewStrictHandlerWithOptions(s, nil, api.StrictHTTPServerOptions{
		// Validation has already passed, so a body that will not decode is a
		// fault here, not in the request.
		RequestErrorHandlerFunc:  s.serverError,
		ResponseErrorHandlerFunc: s.serverError,
	})
	routes := api.HandlerWithOptions(strict, api.StdHTTPServerOptions{
		BaseRouter:       http.NewServeMux(),
		ErrorHandlerFunc: s.badParameter,
	})
	return validate(routes), nil
}

// errNotImplemented marks an operation the rebuild has not reached yet.
var errNotImplemented = errors.New("not implemented")

// serverError answers a handler's error. Not implemented is a 501, which no
// operation documents, so the acceptance suite fails loudly on one.
func (s *Server) serverError(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, errNotImplemented) {
		writeJSON(w, http.StatusNotImplemented, api.Error{Error: "Not implemented"})
		return
	}
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
