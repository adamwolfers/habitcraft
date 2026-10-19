package habitcraft

import (
	"context"
	"errors"
	"strings"

	"github.com/adamwolfers/habitcraft/server/api"
)

// The profile operations, matching the Node backend's routes/users.js.
// GetCurrentUser and ChangePassword are with the auth operations in auth.go.

// UpdateCurrentUser changes the user's name, email, or both.
func (s *Server) UpdateCurrentUser(ctx context.Context, request api.UpdateCurrentUserRequestObject) (api.UpdateCurrentUserResponseObject, error) {
	var name, email *string
	if request.Body.Name != nil {
		trimmed := strings.TrimSpace(*request.Body.Name)
		if trimmed == "" {
			return api.UpdateCurrentUser400JSONResponse{ValidationFailedJSONResponse: fieldError("name", "Name is required")}, nil
		}
		name = &trimmed
	}
	if request.Body.Email != nil {
		normalized := normalizeEmail(string(*request.Body.Email))
		email = &normalized
	}
	if name == nil && email == nil {
		return api.UpdateCurrentUser400JSONResponse{ValidationFailedJSONResponse: api.ValidationFailedJSONResponse{
			Errors: []api.ValidationError{{Msg: "At least one field (name or email) is required"}},
		}}, nil
	}

	u, err := s.store.updateUser(ctx, userFrom(ctx), name, email)
	switch {
	case errors.Is(err, errEmailTaken):
		return api.UpdateCurrentUser409JSONResponse{Error: "Email is already in use"}, nil
	case errors.Is(err, errNoSuchUser):
		return api.UpdateCurrentUser404JSONResponse{UserNotFoundJSONResponse: api.UserNotFoundJSONResponse{Error: "User not found"}}, nil
	case err != nil:
		return nil, err
	}
	return api.UpdateCurrentUser200JSONResponse(profile(u)), nil
}

// DeleteCurrentUser deletes the account and everything in it, once the
// password checks out.
func (s *Server) DeleteCurrentUser(ctx context.Context, request api.DeleteCurrentUserRequestObject) (api.DeleteCurrentUserResponseObject, error) {
	r := requestFrom(ctx)
	if request.Body.Password == "" {
		return api.DeleteCurrentUser400JSONResponse{Error: "Password confirmation required"}, nil
	}
	notFound := api.DeleteCurrentUser404JSONResponse{UserNotFoundJSONResponse: api.UserNotFoundJSONResponse{Error: "User not found"}}

	u, err := s.store.userByID(ctx, userFrom(ctx))
	if errors.Is(err, errNoSuchUser) {
		return notFound, nil
	}
	if err != nil {
		return nil, err
	}
	ok, err := passwordMatches(u.passwordHash, request.Body.Password)
	if err != nil {
		return nil, err
	}
	if !ok {
		return api.DeleteCurrentUser401JSONResponse{Error: "Invalid password"}, nil
	}

	err = s.store.deleteUser(ctx, u.id)
	if errors.Is(err, errNoSuchUser) {
		return notFound, nil
	}
	if err != nil {
		return nil, err
	}
	s.securityEvent(r, "ACCOUNT_DELETED", "userId", u.id, "email", u.email)
	return api.DeleteCurrentUser204Response{}, nil
}
