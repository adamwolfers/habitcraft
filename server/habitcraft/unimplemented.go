package habitcraft

import (
	"context"

	"github.com/adamwolfers/habitcraft/server/api"
)

// The operations the rebuild has not reached. Each answers 501 until its bead
// lands (habitcraft-vxln.5 users, habits and completions); move a method out
// of this file as it is implemented.

func (s *Server) CreateCompletion(context.Context, api.CreateCompletionRequestObject) (api.CreateCompletionResponseObject, error) {
	return nil, errNotImplemented
}

func (s *Server) CreateHabit(context.Context, api.CreateHabitRequestObject) (api.CreateHabitResponseObject, error) {
	return nil, errNotImplemented
}

func (s *Server) DeleteCompletion(context.Context, api.DeleteCompletionRequestObject) (api.DeleteCompletionResponseObject, error) {
	return nil, errNotImplemented
}

func (s *Server) DeleteCurrentUser(context.Context, api.DeleteCurrentUserRequestObject) (api.DeleteCurrentUserResponseObject, error) {
	return nil, errNotImplemented
}

func (s *Server) DeleteHabit(context.Context, api.DeleteHabitRequestObject) (api.DeleteHabitResponseObject, error) {
	return nil, errNotImplemented
}

func (s *Server) ListCompletions(context.Context, api.ListCompletionsRequestObject) (api.ListCompletionsResponseObject, error) {
	return nil, errNotImplemented
}

func (s *Server) ListHabits(context.Context, api.ListHabitsRequestObject) (api.ListHabitsResponseObject, error) {
	return nil, errNotImplemented
}

func (s *Server) UpdateCompletionNote(context.Context, api.UpdateCompletionNoteRequestObject) (api.UpdateCompletionNoteResponseObject, error) {
	return nil, errNotImplemented
}

func (s *Server) UpdateCurrentUser(context.Context, api.UpdateCurrentUserRequestObject) (api.UpdateCurrentUserResponseObject, error) {
	return nil, errNotImplemented
}

func (s *Server) UpdateHabit(context.Context, api.UpdateHabitRequestObject) (api.UpdateHabitResponseObject, error) {
	return nil, errNotImplemented
}
