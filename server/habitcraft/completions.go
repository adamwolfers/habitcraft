package habitcraft

import (
	"context"
	"errors"
	"fmt"
	"time"
	// The zone database, built in: the server's image has none, and an
	// embedding application's may not either.
	_ "time/tzdata"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/adamwolfers/habitcraft/server/api"
)

// The completion operations, matching the Node backend's routes/completions.js
// with one difference: another user's habit is a 404, as a missing one is,
// never the 403 Node answers. A caller cannot learn which habit ids exist.

// ListCompletions lists a habit's completions, newest first.
func (s *Server) ListCompletions(ctx context.Context, request api.ListCompletionsRequestObject) (api.ListCompletionsResponseObject, error) {
	from, to := dateOrNil(request.Params.StartDate), dateOrNil(request.Params.EndDate)
	list, err := s.store.completions(ctx, userFrom(ctx), request.HabitId, from, to)
	if errors.Is(err, errNoSuchHabit) {
		return api.ListCompletions404JSONResponse{CompletionNotFoundJSONResponse: habitNotFoundError}, nil
	}
	if err != nil {
		return nil, err
	}
	out := make(api.ListCompletions200JSONResponse, 0, len(list))
	for _, c := range list {
		out = append(out, completionOut(c))
	}
	return out, nil
}

// maxRangeDays is the longest range ListCompletionsInRange answers, both ends
// included: the year and a day GET /habits embeds. The Node backend's
// MAX_RANGE_DAYS is the same.
const maxRangeDays = embedDays

// ListCompletionsInRange lists every habit the user has, each with its
// completions in the range, so a client draws them all from one request.
func (s *Server) ListCompletionsInRange(ctx context.Context, request api.ListCompletionsInRangeRequestObject) (api.ListCompletionsInRangeResponseObject, error) {
	from, to := request.Params.StartDate.Time, request.Params.EndDate.Time
	switch {
	case to.Before(from):
		return api.ListCompletionsInRange400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{
			Error: "endDate must not be before startDate",
		}}, nil
	case to.Sub(from) >= maxRangeDays*24*time.Hour:
		return api.ListCompletionsInRange400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{
			Error: fmt.Sprintf("The range can be at most %d days", maxRangeDays),
		}}, nil
	}
	habits, err := s.store.habitsBetween(ctx, userFrom(ctx), from, to)
	if err != nil {
		return nil, err
	}
	out := make(api.ListCompletionsInRange200JSONResponse, 0, len(habits))
	for _, h := range habits {
		completions := make([]api.Completion, 0, len(h.completions))
		for _, c := range h.completions {
			completions = append(completions, completionOut(c))
		}
		out = append(out, api.HabitCompletions{HabitId: h.id, Completions: completions})
	}
	return out, nil
}

// CreateCompletion records the habit as done on a day, today or before, where
// today is the date in the user's time zone (habitcraft-vxln.19).
func (s *Server) CreateCompletion(ctx context.Context, request api.CreateCompletionRequestObject) (api.CreateCompletionResponseObject, error) {
	date := request.Body.Date.Time
	today, ok := todayIn(request.Body.TimeZone)
	if !ok {
		return api.CreateCompletion400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{
			Error: "Unknown time zone",
		}}, nil
	}
	if date.After(today) {
		return api.CreateCompletion400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{
			Error: "Cannot mark completions for future dates",
		}}, nil
	}
	var notes *string
	if request.Body.Notes != nil {
		notes = nilIfBlank(*request.Body.Notes)
	}
	c, err := s.store.createCompletion(ctx, userFrom(ctx), completion{
		id:      uuid.New(),
		habitID: request.HabitId,
		date:    date,
		notes:   notes,
	})
	switch {
	case errors.Is(err, errNoSuchHabit):
		return api.CreateCompletion404JSONResponse{CompletionNotFoundJSONResponse: habitNotFoundError}, nil
	case errors.Is(err, errAlreadyCompleted):
		return api.CreateCompletion409JSONResponse{Error: "Habit already completed for this date"}, nil
	case err != nil:
		return nil, err
	}
	return api.CreateCompletion201JSONResponse(completionOut(c)), nil
}

// UpdateCompletionNote sets a completed day's note. A null, blank or missing
// note clears it.
func (s *Server) UpdateCompletionNote(ctx context.Context, request api.UpdateCompletionNoteRequestObject) (api.UpdateCompletionNoteResponseObject, error) {
	var notes *string
	if request.Body.Notes != nil {
		notes = nilIfBlank(*request.Body.Notes)
	}
	c, err := s.store.setCompletionNote(ctx, userFrom(ctx), request.HabitId, request.Date.Time, notes)
	switch {
	case errors.Is(err, errNoSuchHabit):
		return api.UpdateCompletionNote404JSONResponse{CompletionNotFoundJSONResponse: habitNotFoundError}, nil
	case errors.Is(err, errNoSuchCompletion):
		return api.UpdateCompletionNote404JSONResponse{CompletionNotFoundJSONResponse: completionNotFoundError}, nil
	case err != nil:
		return nil, err
	}
	return api.UpdateCompletionNote200JSONResponse(completionOut(c)), nil
}

// DeleteCompletion unchecks a day.
func (s *Server) DeleteCompletion(ctx context.Context, request api.DeleteCompletionRequestObject) (api.DeleteCompletionResponseObject, error) {
	err := s.store.deleteCompletion(ctx, userFrom(ctx), request.HabitId, request.Date.Time)
	switch {
	case errors.Is(err, errNoSuchHabit):
		return api.DeleteCompletion404JSONResponse{CompletionNotFoundJSONResponse: habitNotFoundError}, nil
	case errors.Is(err, errNoSuchCompletion):
		return api.DeleteCompletion404JSONResponse{CompletionNotFoundJSONResponse: completionNotFoundError}, nil
	case err != nil:
		return nil, err
	}
	return api.DeleteCompletion200JSONResponse{
		Message: "Completion deleted successfully",
		HabitId: request.HabitId.String(),
		Date:    request.Date,
	}, nil
}

var (
	habitNotFoundError      = api.CompletionNotFoundJSONResponse{Error: "Habit not found"}
	completionNotFoundError = api.CompletionNotFoundJSONResponse{Error: "Completion not found"}
)

func completionOut(c completion) api.Completion {
	return api.Completion{
		Id:        c.id,
		HabitId:   c.habitID,
		Date:      openapi_types.Date{Time: c.date},
		Notes:     c.notes,
		CreatedAt: c.createdAt,
	}
}

func dateOrNil(d *openapi_types.Date) *time.Time {
	if d == nil {
		return nil
	}
	return &d.Time
}

// todayIn is today's date in the IANA time zone the client named, or in UTC
// when it named none, as midnight UTC like every date the API carries. It is
// false for a zone that is not in the database. "Local" and "" are refused
// too: LoadLocation reads them as the server's zone and UTC, neither of which
// is the user's.
func todayIn(zone *string) (time.Time, bool) {
	if zone == nil {
		return today(), true
	}
	if *zone == "" || *zone == "Local" {
		return time.Time{}, false
	}
	loc, err := time.LoadLocation(*zone)
	if err != nil {
		return time.Time{}, false
	}
	y, m, d := time.Now().In(loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC), true
}
