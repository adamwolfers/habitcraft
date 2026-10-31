package habitcraft

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/adamwolfers/habitcraft/server/api"
)

func statsPath(habitID uuid.UUID) string {
	return habitPath(habitID) + "/stats"
}

func (a *app) stats(u testUser, habitID uuid.UUID) api.HabitStats {
	a.t.Helper()
	w := a.as(u, http.MethodGet, statsPath(habitID), "")
	if w.Code != http.StatusOK {
		a.t.Fatalf("stats: %d %s", w.Code, w.Body)
	}
	return decode[api.HabitStats](a.t, w)
}

func (a *app) checkOffDaysAgo(u testUser, habitID uuid.UUID, days ...int) {
	a.t.Helper()
	for _, ago := range days {
		if w := a.checkOffDay(u, habitID, `{"date":"`+dateString(ago)+`"}`); w.Code != http.StatusCreated {
			a.t.Fatalf("check off %d days ago: %d %s", ago, w.Code, w.Body)
		}
	}
}

// backdate moves a habit's creation n days into the past, which no request
// can do.
func (a *app) backdate(habitID uuid.UUID, n int) {
	a.store.mu.Lock()
	defer a.store.mu.Unlock()
	h := a.store.habitRows[habitID]
	h.createdAt = h.createdAt.AddDate(0, 0, -n)
	a.store.habitRows[habitID] = h
}

func rateOf(completed, total int) api.CompletionRate {
	return api.CompletionRate{CompletedDays: completed, TotalDays: total, Rate: float64(completed) / float64(total)}
}

func TestStatsCountEachWindowFromTheHabitsStart(t *testing.T) {
	for _, tc := range []struct {
		name            string
		createdAgo      int
		doneAgo         []int
		last30, last365 api.CompletionRate
	}{
		{"created today, never done", 0, nil, rateOf(0, 1), rateOf(0, 1)},
		{"created today, done today", 0, []int{0}, rateOf(1, 1), rateOf(1, 1)},
		{"created a week ago", 6, []int{6, 2}, rateOf(2, 7), rateOf(2, 7)},
		{"a day done before creation starts it then", 0, []int{9, 4, 0}, rateOf(3, 10), rateOf(3, 10)},
		{"creation before the first day done starts it then", 20, []int{1}, rateOf(1, 21), rateOf(1, 21)},
		{"old enough to fill both windows", 500, []int{400, 100, 30, 29, 1, 0}, rateOf(3, 30), rateOf(5, 365)},
		{"a first day done before both windows fills them", 0, []int{400}, rateOf(0, 30), rateOf(0, 365)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := newApp(t)
			alice := a.newUser()
			h := a.createHabit(alice, `{"name":"Run"}`)
			a.backdate(h.Id, tc.createdAgo)
			a.checkOffDaysAgo(alice, h.Id, tc.doneAgo...)

			got := a.stats(alice, h.Id)

			want := api.HabitStats{HabitId: h.Id, Last30Days: tc.last30, Last365Days: tc.last365}
			if got != want {
				t.Errorf("got %+v, want %+v", got, want)
			}
		})
	}
}

// The creation day is the UTC calendar day of created_at, however late in
// that day it was.
func TestStatsTakeTheCreationDayInUTC(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)
	a.store.mu.Lock()
	row := a.store.habitRows[h.Id]
	row.createdAt = daysAgo(2).Add(23*time.Hour + 59*time.Minute).In(time.FixedZone("UTC-8", -8*3600))
	a.store.habitRows[h.Id] = row
	a.store.mu.Unlock()

	if got := a.stats(alice, h.Id).Last30Days; got != rateOf(0, 3) {
		t.Errorf("got %+v, want 0 of 3", got)
	}
}

func TestStatsCountOnlyThatHabitsDays(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	run := a.createHabit(alice, `{"name":"Run"}`)
	read := a.createHabit(alice, `{"name":"Read"}`)
	a.checkOffDaysAgo(alice, read.Id, 0)

	if got := a.stats(alice, run.Id).Last30Days; got != rateOf(0, 1) {
		t.Errorf("got %+v", got)
	}
}

// Another user's habit is a 404, as a missing one is.
func TestStatsOfAnotherUsersHabitAreNotFound(t *testing.T) {
	a := newApp(t)
	alice, bob := a.newUser(), a.newUser()
	run := a.createHabit(alice, `{"name":"Run"}`)

	for _, id := range []uuid.UUID{run.Id, uuid.New()} {
		w := a.as(bob, http.MethodGet, statsPath(id), "")
		if w.Code != http.StatusNotFound || errorOf(t, w) != "Habit not found" {
			t.Errorf("%s: got %d %s", id, w.Code, w.Body)
		}
	}
}

func TestStatsNeedSigningIn(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	run := a.createHabit(alice, `{"name":"Run"}`)

	if w := a.do(http.MethodGet, statsPath(run.Id), ""); w.Code != http.StatusUnauthorized {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

func TestStatsStoreFailureIs500WithoutDetail(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	run := a.createHabit(alice, `{"name":"Run"}`)
	a.store.err = errDatabaseDown

	w := a.as(alice, http.MethodGet, statsPath(run.Id), "")

	if w.Code != http.StatusInternalServerError || errorOf(t, w) != "Internal server error" ||
		strings.Contains(w.Body.String(), errDatabaseDown.Error()) {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}
