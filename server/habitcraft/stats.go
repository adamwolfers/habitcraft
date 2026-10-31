package habitcraft

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/adamwolfers/habitcraft/server/api"
)

// The windows GetHabitStats measures, each ending today.
const (
	shortWindowDays = 30
	longWindowDays  = 365
)

// GetHabitStats reports how often a habit was done over the last 30 and 365
// days. Each window starts no earlier than the habit did: the earlier of its
// creation day in UTC and its first completion, since a day before creation
// can be checked off. So a rate is never above 1, and today always counts.
func (s *Server) GetHabitStats(ctx context.Context, request api.GetHabitStatsRequestObject) (api.GetHabitStatsResponseObject, error) {
	user, habitID := userFrom(ctx), request.HabitId
	created, firstDone, err := s.store.habitStart(ctx, user, habitID)
	if errors.Is(err, errNoSuchHabit) {
		return api.GetHabitStats404JSONResponse{CompletionNotFoundJSONResponse: habitNotFoundError}, nil
	}
	if err != nil {
		return nil, err
	}
	end := today()
	done, err := s.daysDone(ctx, user, habitID, end.AddDate(0, 0, 1-longWindowDays), end)
	if err != nil {
		return nil, err
	}
	start := dayOf(created)
	if firstDone != nil && firstDone.Before(start) {
		start = *firstDone
	}
	return api.GetHabitStats200JSONResponse{
		HabitId:     habitID,
		Last30Days:  rateOver(done, start, end, shortWindowDays),
		Last365Days: rateOver(done, start, end, longWindowDays),
	}, nil
}

// daysDone lists the days the habit was done from from to to inclusive.
func (s *Server) daysDone(ctx context.Context, user, habitID uuid.UUID, from, to time.Time) ([]time.Time, error) {
	completions, err := s.store.completions(ctx, user, habitID, &from, &to)
	if err != nil {
		return nil, err
	}
	days := make([]time.Time, 0, len(completions))
	for _, c := range completions {
		days = append(days, c.date)
	}
	return days, nil
}

// rateOver counts the days done in the window of days ending on end, cut to
// start when the habit started later.
func rateOver(done []time.Time, start, end time.Time, days int) api.CompletionRate {
	from := end.AddDate(0, 0, 1-days)
	if start.After(from) {
		from = start
	}
	total := int(end.Sub(from).Hours()/24) + 1
	completed := 0
	for _, day := range done {
		if !day.Before(from) && !day.After(end) {
			completed++
		}
	}
	return api.CompletionRate{CompletedDays: completed, TotalDays: total, Rate: float64(completed) / float64(total)}
}

// dayOf is midnight UTC on the UTC calendar day of t.
func dayOf(t time.Time) time.Time {
	y, m, d := t.UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
