package habitcraft

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/adamwolfers/habitcraft/server/api"
)

// The habit operations, matching the Node backend's routes/habits.js, except
// that GET /habits embeds a bounded window of completions (habitcraft-172z).

const (
	// maxHabitsPerUser counts archived habits too, as on the Node backend.
	maxHabitsPerUser = 50
	defaultColor     = "#3B82F6"
	defaultIcon      = "⭐"
	// maxIconLength is the icons column's width, varchar(10), which the spec
	// does not state. Checked here so a longer icon is a 400, not a 500.
	maxIconLength = 10
	// embedDays is how many days of completions GET /habits embeds, today
	// included: a year and a day, so a year ago today is in. Older ones come
	// from a habit's own completions list.
	embedDays = 366
)

// ListHabits lists the user's habits, each with its recent completions.
func (s *Server) ListHabits(ctx context.Context, request api.ListHabitsRequestObject) (api.ListHabitsResponseObject, error) {
	status := ""
	if request.Params.Status != nil {
		status = string(*request.Params.Status)
	}
	since := today().AddDate(0, 0, 1-embedDays)
	habits, err := s.store.habits(ctx, userFrom(ctx), status, since)
	if err != nil {
		return api.ListHabits500JSONResponse{HabitInternalErrorJSONResponse: s.habitFailure(ctx, "Failed to fetch habits", err)}, nil
	}
	list := make(api.ListHabits200JSONResponse, 0, len(habits))
	for _, h := range habits {
		out := habitWithCompletionsOut(h.habit)
		for _, c := range h.completions {
			out.Completions = append(out.Completions, completionOut(c))
		}
		list = append(list, out)
	}
	return list, nil
}

// CreateHabit saves a new habit, unless the user already has the most allowed.
func (s *Server) CreateHabit(ctx context.Context, request api.CreateHabitRequestObject) (api.CreateHabitResponseObject, error) {
	in, problem := cleanHabitInput(*request.Body)
	if problem != "" {
		return api.CreateHabit400JSONResponse{HabitBadRequestJSONResponse: habitBadRequest(problem)}, nil
	}
	h := habit{
		id:          uuid.New(),
		userID:      userFrom(ctx),
		name:        in.Name,
		description: in.Description,
		color:       valueOr(in.Color, defaultColor),
		icon:        valueOr(in.Icon, defaultIcon),
		status:      string(valueOr(in.Status, api.HabitInputStatus("active"))),
	}
	h, err := s.store.createHabit(ctx, h, maxHabitsPerUser)
	if errors.Is(err, errHabitLimit) {
		return api.CreateHabit403JSONResponse{
			Error: "Habit limit reached",
			Message: fmt.Sprintf("You have reached the maximum of %d habits. "+
				"Please delete or archive existing habits before creating new ones.", maxHabitsPerUser),
		}, nil
	}
	if err != nil {
		return api.CreateHabit500JSONResponse{HabitInternalErrorJSONResponse: s.habitFailure(ctx, "Failed to create habit", err)}, nil
	}
	return api.CreateHabit201JSONResponse(habitOut(h)), nil
}

// UpdateHabit changes the fields the request names. A description sent as
// null or blank is cleared; one not sent is left alone.
func (s *Server) UpdateHabit(ctx context.Context, request api.UpdateHabitRequestObject) (api.UpdateHabitResponseObject, error) {
	in, problem := cleanHabitInput(*request.Body)
	if problem != "" {
		return api.UpdateHabit400JSONResponse{HabitBadRequestJSONResponse: habitBadRequest(problem)}, nil
	}
	changes := habitChanges{
		name:           in.Name,
		setDescription: in.Description != nil || bodyHas(ctx, "description"),
		description:    in.Description,
		color:          in.Color,
		icon:           in.Icon,
		status:         (*string)(in.Status),
	}
	h, err := s.store.updateHabit(ctx, userFrom(ctx), request.HabitId, changes)
	if errors.Is(err, errNoSuchHabit) {
		return api.UpdateHabit404JSONResponse{HabitNotFoundJSONResponse: habitNotFound()}, nil
	}
	if err != nil {
		return api.UpdateHabit500JSONResponse{HabitInternalErrorJSONResponse: s.habitFailure(ctx, "Failed to update habit", err)}, nil
	}
	return api.UpdateHabit200JSONResponse(habitOut(h)), nil
}

// DeleteHabit removes a habit and its completions.
func (s *Server) DeleteHabit(ctx context.Context, request api.DeleteHabitRequestObject) (api.DeleteHabitResponseObject, error) {
	err := s.store.deleteHabit(ctx, userFrom(ctx), request.HabitId)
	if errors.Is(err, errNoSuchHabit) {
		return api.DeleteHabit404JSONResponse{HabitNotFoundJSONResponse: habitNotFound()}, nil
	}
	if err != nil {
		return api.DeleteHabit500JSONResponse{HabitInternalErrorJSONResponse: s.habitFailure(ctx, "Failed to delete habit", err)}, nil
	}
	return api.DeleteHabit204Response{}, nil
}

// cleanHabitInput trims the strings and blanks a blank description, then
// checks what the spec cannot say. It returns a problem to report, or "".
func cleanHabitInput(in api.HabitInput) (api.HabitInput, string) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Description != nil {
		in.Description = nilIfBlank(*in.Description)
	}
	if in.Icon != nil {
		icon := strings.TrimSpace(*in.Icon)
		in.Icon = &icon
	}
	switch {
	case in.Name == "":
		return in, "name is required and must be a non-empty string"
	case in.Icon != nil && utf8.RuneCountInString(*in.Icon) > maxIconLength:
		return in, fmt.Sprintf("icon must not exceed %d characters", maxIconLength)
	}
	return in, ""
}

func habitOut(h habit) api.Habit {
	return api.Habit{
		Id:          h.id,
		UserId:      h.userID,
		Name:        h.name,
		Description: h.description,
		Color:       h.color,
		Icon:        h.icon,
		Status:      api.HabitStatus(h.status),
		CreatedAt:   h.createdAt,
		UpdatedAt:   h.updatedAt,
	}
}

func habitWithCompletionsOut(h habit) api.HabitWithCompletions {
	out := habitOut(h)
	return api.HabitWithCompletions{
		Id:          out.Id,
		UserId:      out.UserId,
		Name:        out.Name,
		Description: out.Description,
		Color:       out.Color,
		Icon:        out.Icon,
		Status:      api.HabitWithCompletionsStatus(out.Status),
		CreatedAt:   out.CreatedAt,
		UpdatedAt:   out.UpdatedAt,
		Completions: []api.Completion{},
	}
}

// The habits routes answer errors in the DetailedError shape.

func habitBadRequest(message string) api.HabitBadRequestJSONResponse {
	return api.HabitBadRequestJSONResponse{Error: "Validation error", Message: message, StatusCode: 400}
}

func habitNotFound() api.HabitNotFoundJSONResponse {
	return api.HabitNotFoundJSONResponse{Error: "Habit not found", Message: "Habit not found or access denied", StatusCode: 404}
}

// habitFailure logs err and returns the 500 a habits route documents.
func (s *Server) habitFailure(ctx context.Context, message string, err error) api.HabitInternalErrorJSONResponse {
	s.logger.ErrorContext(ctx, "request failed", "err", err)
	return api.HabitInternalErrorJSONResponse{Error: "Internal server error", Message: message, StatusCode: 500}
}

// today is midnight UTC today, the day a date with no time zone is measured
// against, as on the Node backend.
func today() time.Time {
	y, m, d := time.Now().UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func valueOr[T any](p *T, otherwise T) T {
	if p == nil {
		return otherwise
	}
	return *p
}

// nilIfBlank trims s, and returns nil when nothing is left.
func nilIfBlank(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
