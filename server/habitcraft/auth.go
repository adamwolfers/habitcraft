package habitcraft

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/google/uuid"

	"github.com/adamwolfers/habitcraft/server/api"
)

// The auth operations, matching the Node backend's routes/auth.js and the
// change-password route in routes/users.js. AUTHENTICATION.md describes the
// flows.

// Register creates an account and starts its first session.
func (s *Server) Register(ctx context.Context, request api.RegisterRequestObject) (api.RegisterResponseObject, error) {
	email := normalizeEmail(string(request.Body.Email))
	name := strings.TrimSpace(request.Body.Name)
	if name == "" {
		return api.Register400JSONResponse{ValidationFailedJSONResponse: fieldError("name", "Name is required")}, nil
	}
	hash, err := hashPassword(request.Body.Password)
	if err != nil {
		return nil, err
	}
	id := uuid.New()
	pair, err := s.tokens.issue(id)
	if err != nil {
		return nil, err
	}
	u, err := s.store.createUser(ctx, user{id: id, email: email, name: name, passwordHash: hash}, sessionFor(id, pair))
	if errors.Is(err, errEmailTaken) {
		return api.Register409JSONResponse{Error: "User with this email already exists"}, nil
	}
	if err != nil {
		return nil, err
	}

	r := requestFrom(ctx)
	s.securityEvent(r, "REGISTER_SUCCESS", "email", u.email, "userId", u.id)
	return registered{
		Register201JSONResponse: api.Register201JSONResponse(authResponse(u, pair)),
		cookies:                 s.sessionCookies(pair),
	}, nil
}

// Login checks the credentials and starts a session.
func (s *Server) Login(ctx context.Context, request api.LoginRequestObject) (api.LoginResponseObject, error) {
	r := requestFrom(ctx)
	email := normalizeEmail(string(request.Body.Email))
	refused := api.Login401JSONResponse{Error: "Invalid credentials"}

	u, err := s.store.userByEmail(ctx, email)
	if errors.Is(err, errNoSuchUser) {
		spendPasswordCheck(request.Body.Password)
		s.securityEvent(r, "LOGIN_FAILURE", "email", email, "reason", "user_not_found")
		return refused, nil
	}
	if err != nil {
		return nil, err
	}
	ok, err := passwordMatches(u.passwordHash, request.Body.Password)
	if err != nil {
		return nil, err
	}
	if !ok {
		s.securityEvent(r, "LOGIN_FAILURE", "email", email, "reason", "invalid_password")
		return refused, nil
	}

	pair, err := s.startSession(ctx, u.id)
	if err != nil {
		return nil, err
	}
	s.securityEvent(r, "LOGIN_SUCCESS", "email", u.email, "userId", u.id)
	return loggedIn{
		Login200JSONResponse: api.Login200JSONResponse(authResponse(u, pair)),
		cookies:              s.sessionCookies(pair),
	}, nil
}

// RefreshToken trades a refresh token for a new pair. The old refresh token
// is revoked, so each one works once.
func (s *Server) RefreshToken(ctx context.Context, _ api.RefreshTokenRequestObject) (api.RefreshTokenResponseObject, error) {
	r := requestFrom(ctx)
	token := refreshTokenIn(r)
	if token == "" {
		return api.RefreshToken400JSONResponse{Error: "Refresh token is required"}, nil
	}
	refused := func(reason, message string) (api.RefreshTokenResponseObject, error) {
		s.securityEvent(r, "TOKEN_REFRESH_FAILURE", "reason", reason)
		return api.RefreshToken401JSONResponse{Error: message}, nil
	}

	userID, err := s.tokens.verify(token, refreshToken)
	switch {
	case errors.Is(err, errTokenExpired):
		return refused("token_expired", "Refresh token expired")
	case errors.Is(err, errTokenWrongType):
		return refused("invalid_token_type", "Invalid token type")
	case err != nil:
		return refused("invalid_token", "Invalid refresh token")
	}

	pair, err := s.tokens.issue(userID)
	if err != nil {
		return nil, err
	}
	err = s.store.rotateSession(ctx, hashToken(token), sessionFor(userID, pair))
	switch {
	case errors.Is(err, errSessionRevoked):
		return refused("token_revoked", "Token has been revoked")
	case errors.Is(err, errSessionUnknown):
		return refused("token_not_found", "Invalid refresh token")
	case err != nil:
		return nil, err
	}

	s.securityEvent(r, "TOKEN_REFRESH_SUCCESS", "userId", userID)
	return refreshed{
		RefreshToken200JSONResponse: api.RefreshToken200JSONResponse{AccessToken: pair.access, RefreshToken: pair.refresh},
		cookies:                     s.sessionCookies(pair),
	}, nil
}

// Logout ends the session in the refreshToken cookie, if there is one, and
// clears both cookies. It always succeeds: the caller is signed out either way.
func (s *Server) Logout(ctx context.Context, _ api.LogoutRequestObject) (api.LogoutResponseObject, error) {
	r := requestFrom(ctx)
	if cookie, err := r.Cookie(refreshCookie); err == nil && cookie.Value != "" {
		if err := s.store.endSession(ctx, hashToken(cookie.Value)); err != nil {
			// The token stays valid until it expires; the client has
			// already dropped it.
			s.logger.ErrorContext(ctx, "logout could not revoke the refresh token", "err", err)
		}
	}
	s.securityEvent(r, "LOGOUT")
	return loggedOut{
		Logout200JSONResponse: api.Logout200JSONResponse{Message: "Logged out successfully"},
		cookies:               []*http.Cookie{s.clearedCookie(accessCookie), s.clearedCookie(refreshCookie)},
	}, nil
}

// GetCurrentUser returns the signed-in user's profile.
func (s *Server) GetCurrentUser(ctx context.Context, _ api.GetCurrentUserRequestObject) (api.GetCurrentUserResponseObject, error) {
	u, err := s.store.userByID(ctx, userFrom(ctx))
	if errors.Is(err, errNoSuchUser) {
		return api.GetCurrentUser404JSONResponse{UserNotFoundJSONResponse: api.UserNotFoundJSONResponse{Error: "User not found"}}, nil
	}
	if err != nil {
		return nil, err
	}
	return api.GetCurrentUser200JSONResponse(profile(u)), nil
}

// ChangePassword sets a new password once the current one checks out. Every
// session the user has is revoked, the caller's included, and the caller gets
// a fresh pair: a copy of any old token, stolen or not, stops working, and the
// user stays signed in where they made the change (habitcraft-4k7v).
func (s *Server) ChangePassword(ctx context.Context, request api.ChangePasswordRequestObject) (api.ChangePasswordResponseObject, error) {
	r := requestFrom(ctx)
	body := request.Body
	if body.ConfirmPassword != body.NewPassword {
		return api.ChangePassword400JSONResponse{ValidationFailedJSONResponse: fieldError("confirmPassword", "Passwords do not match")}, nil
	}

	u, err := s.store.userByID(ctx, userFrom(ctx))
	if errors.Is(err, errNoSuchUser) {
		return api.ChangePassword404JSONResponse{UserNotFoundJSONResponse: api.UserNotFoundJSONResponse{Error: "User not found"}}, nil
	}
	if err != nil {
		return nil, err
	}
	ok, err := passwordMatches(u.passwordHash, body.CurrentPassword)
	if err != nil {
		return nil, err
	}
	if !ok {
		s.securityEvent(r, "PASSWORD_CHANGE_FAILURE", "userId", u.id, "reason", "invalid_password")
		return api.ChangePassword401JSONResponse{Error: "Invalid current password"}, nil
	}

	hash, err := hashPassword(body.NewPassword)
	if err != nil {
		return nil, err
	}
	pair, err := s.tokens.issue(u.id)
	if err != nil {
		return nil, err
	}
	if err := s.store.changePassword(ctx, u.id, hash, sessionFor(u.id, pair)); err != nil {
		return nil, err
	}

	s.securityEvent(r, "PASSWORD_CHANGE_SUCCESS", "userId", u.id, "email", u.email)
	return passwordChanged{
		ChangePassword200JSONResponse: api.ChangePassword200JSONResponse{
			Message:      "Password changed successfully",
			AccessToken:  pair.access,
			RefreshToken: pair.refresh,
		},
		cookies: s.sessionCookies(pair),
	}, nil
}

// startSession issues a pair for an existing user and stores its refresh token.
func (s *Server) startSession(ctx context.Context, userID uuid.UUID) (tokenPair, error) {
	pair, err := s.tokens.issue(userID)
	if err != nil {
		return tokenPair{}, err
	}
	return pair, s.store.startSession(ctx, sessionFor(userID, pair))
}

func sessionFor(userID uuid.UUID, pair tokenPair) session {
	return session{userID: userID, tokenHash: hashToken(pair.refresh), expiresAt: pair.refreshExpires}
}

// normalizeEmail is how an address is stored and looked up, so sign-in works
// whatever case it is typed in.
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// maxRefreshBody bounds the refresh request body read, which the spec does not
// describe and request validation therefore does not limit.
const maxRefreshBody = 64 << 10

// refreshTokenIn finds the refresh token: the cookie first, then a JSON body,
// which older clients send.
func refreshTokenIn(r *http.Request) string {
	if cookie, err := r.Cookie(refreshCookie); err == nil && cookie.Value != "" {
		return cookie.Value
	}
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	_ = json.NewDecoder(io.LimitReader(r.Body, maxRefreshBody)).Decode(&body)
	return body.RefreshToken
}

func profile(u user) api.User {
	return api.User{
		Id:        u.id,
		Email:     openapi_types.Email(u.email),
		Name:      u.name,
		CreatedAt: u.createdAt,
	}
}

func authResponse(u user, pair tokenPair) api.AuthResponse {
	return api.AuthResponse{User: profile(u), AccessToken: pair.access, RefreshToken: pair.refresh}
}

// fieldError is a one-field 400 in the express-validator shape the auth and
// user operations document, for a rule the spec cannot express.
func fieldError(field, message string) api.ValidationFailedJSONResponse {
	kind, location := "field", "body"
	return api.ValidationFailedJSONResponse{Errors: []api.ValidationError{
		{Type: &kind, Msg: message, Path: &field, Location: &location},
	}}
}

// --- cookies --------------------------------------------------------------

// sessionCookies carry a pair for the web client, with the lifetimes the
// tokens themselves have.
func (s *Server) sessionCookies(pair tokenPair) []*http.Cookie {
	return []*http.Cookie{
		s.cookie(accessCookie, pair.access, accessTokenTTL),
		s.cookie(refreshCookie, pair.refresh, refreshTokenTTL),
	}
}

func (s *Server) clearedCookie(name string) *http.Cookie {
	c := s.cookie(name, "", 0)
	c.MaxAge = -1 // Max-Age=0: delete now
	c.Expires = time.Unix(0, 0)
	return c
}

func (s *Server) cookie(name, value string, lifetime time.Duration) *http.Cookie {
	c := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   int(lifetime.Seconds()),
		Expires:  time.Now().Add(lifetime),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	}
	if s.insecureCookies {
		c.Secure = false
		c.SameSite = http.SameSiteLaxMode
	}
	return c
}

func setCookies(w http.ResponseWriter, cookies []*http.Cookie) {
	for _, c := range cookies {
		http.SetCookie(w, c)
	}
}

// The spec does not model Set-Cookie, so the generated responses cannot set
// one. Each of these wraps a generated response and sets the cookies first.

type registered struct {
	api.Register201JSONResponse
	cookies []*http.Cookie
}

func (r registered) VisitRegisterResponse(w http.ResponseWriter) error {
	setCookies(w, r.cookies)
	return r.Register201JSONResponse.VisitRegisterResponse(w)
}

type loggedIn struct {
	api.Login200JSONResponse
	cookies []*http.Cookie
}

func (r loggedIn) VisitLoginResponse(w http.ResponseWriter) error {
	setCookies(w, r.cookies)
	return r.Login200JSONResponse.VisitLoginResponse(w)
}

type refreshed struct {
	api.RefreshToken200JSONResponse
	cookies []*http.Cookie
}

func (r refreshed) VisitRefreshTokenResponse(w http.ResponseWriter) error {
	setCookies(w, r.cookies)
	return r.RefreshToken200JSONResponse.VisitRefreshTokenResponse(w)
}

type loggedOut struct {
	api.Logout200JSONResponse
	cookies []*http.Cookie
}

func (r loggedOut) VisitLogoutResponse(w http.ResponseWriter) error {
	setCookies(w, r.cookies)
	return r.Logout200JSONResponse.VisitLogoutResponse(w)
}

type passwordChanged struct {
	api.ChangePassword200JSONResponse
	cookies []*http.Cookie
}

func (r passwordChanged) VisitChangePasswordResponse(w http.ResponseWriter) error {
	setCookies(w, r.cookies)
	return r.ChangePassword200JSONResponse.VisitChangePasswordResponse(w)
}
