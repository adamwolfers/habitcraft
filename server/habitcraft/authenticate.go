package habitcraft

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/routers/gorillamux"
	"github.com/google/uuid"

	"github.com/adamwolfers/habitcraft/server/api"
)

// The cookies the web client's session lives in. The mobile client has no
// cookie jar and sends the access token as a Bearer header instead.
const (
	accessCookie  = "accessToken"
	refreshCookie = "refreshToken"
)

type userIDKey struct{}

// userFrom returns the user authentication put in ctx. Every protected
// operation's handler can rely on it being there.
func userFrom(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(userIDKey{}).(uuid.UUID)
	return id
}

// authentication returns the middleware that checks the access token on
// every operation the spec protects. Which ones those are comes from the
// spec: an operation with a non-empty security list needs a token.
//
// It follows the Node backend's jwtAuth.js: the accessToken cookie wins over
// an Authorization header, and every failure is a 401 in the Error shape,
// which is what every protected operation documents.
//
// spec is modified: its servers are dropped, as validation.Middleware drops
// them, because the router would otherwise match requests by host.
func (s *Server) authentication(spec *openapi3.T) (func(http.Handler) http.Handler, error) {
	spec.Servers = nil
	router, err := gorillamux.NewRouter(spec)
	if err != nil {
		return nil, fmt.Errorf("building the authentication router: %w", err)
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			route, _, err := router.FindRoute(r)
			if err != nil || !protected(spec, route.Operation) {
				next.ServeHTTP(w, r)
				return
			}
			userID, problem, reason := s.authenticate(r)
			if problem != "" {
				s.securityEvent(r, "AUTH_FAILURE", "reason", reason)
				writeJSON(w, http.StatusUnauthorized, api.Error{Error: problem})
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userIDKey{}, userID)))
		})
	}, nil
}

// protected reports whether an operation needs a token. An operation with no
// security list of its own inherits the spec's.
func protected(spec *openapi3.T, operation *openapi3.Operation) bool {
	requirements := spec.Security
	if operation.Security != nil {
		requirements = *operation.Security
	}
	return len(requirements) > 0
}

// authenticate returns the user r's access token belongs to, or the 401
// message for the caller and the reason for the security log.
func (s *Server) authenticate(r *http.Request) (userID uuid.UUID, problem, reason string) {
	token, problem, reason := accessTokenIn(r)
	if problem != "" {
		return uuid.Nil, problem, reason
	}
	userID, err := s.tokens.verify(token, accessToken)
	switch {
	case errors.Is(err, errTokenExpired):
		return uuid.Nil, "Token expired", "token_expired"
	case errors.Is(err, errTokenWrongType):
		return uuid.Nil, "Invalid token type", "invalid_token_type"
	case err != nil:
		return uuid.Nil, "Invalid token", "invalid_token"
	}
	return userID, "", ""
}

// accessTokenIn finds the access token: the cookie first, then the header.
func accessTokenIn(r *http.Request) (token, problem, reason string) {
	if cookie, err := r.Cookie(accessCookie); err == nil && cookie.Value != "" {
		return cookie.Value, "", ""
	}
	header := r.Header.Get("Authorization")
	if header == "" {
		return "", "No token provided", "no_token"
	}
	scheme, token, found := strings.Cut(header, " ")
	if !found || scheme != "Bearer" || strings.Contains(token, " ") {
		return "", "Invalid token format", "invalid_format"
	}
	if token == "" {
		return "", "No token provided", "no_token"
	}
	return token, "", ""
}

// securityEvent logs what the Node backend's logSecurityEvent records: the
// event, the caller's address and user agent, and the details given. Failures
// log at Warn, everything else at Info.
func (s *Server) securityEvent(r *http.Request, event string, details ...any) {
	level := slog.LevelInfo
	if strings.HasSuffix(event, "_FAILURE") {
		level = slog.LevelWarn
	}
	attrs := append([]any{"event", event, "ip", r.RemoteAddr, "userAgent", r.UserAgent()}, details...)
	s.logger.Log(r.Context(), level, "security event", attrs...)
}
