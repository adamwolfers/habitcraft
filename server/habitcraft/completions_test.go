package habitcraft

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/adamwolfers/habitcraft/server/api"
)

func completionsPath(habitID uuid.UUID) string {
	return habitPath(habitID) + "/completions"
}

func (a *app) checkOffDay(u testUser, habitID uuid.UUID, body string) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.as(u, http.MethodPost, completionsPath(habitID), body)
}

func (a *app) listCompletions(u testUser, habitID uuid.UUID, query string) []api.Completion {
	a.t.Helper()
	w := a.as(u, http.MethodGet, completionsPath(habitID)+query, "")
	if w.Code != http.StatusOK {
		a.t.Fatalf("list completions: %d %s", w.Code, w.Body)
	}
	return decode[[]api.Completion](a.t, w)
}

func TestACheckedOffDayIsListedAndEmbedded(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)

	w := a.checkOffDay(alice, h.Id, `{"date":"`+dateString(0)+`","notes":" 5k "}`)

	created := decode[api.Completion](t, w)
	if w.Code != http.StatusCreated || created.HabitId != h.Id || created.Date.String() != dateString(0) ||
		created.Notes == nil || *created.Notes != "5k" || created.CreatedAt.IsZero() {
		t.Fatalf("got %d %+v", w.Code, created)
	}
	// One entity, one wire shape (habitcraft-34d.1): byte for byte the same
	// wherever it is read.
	want := jsonOf(t, created)
	if list := a.listCompletions(alice, h.Id, ""); len(list) != 1 || jsonOf(t, list[0]) != want {
		t.Errorf("listed %+v, created %s", list, want)
	}
	if habits := a.listHabits(alice, ""); len(habits[0].Completions) != 1 || jsonOf(t, habits[0].Completions[0]) != want {
		t.Errorf("embedded %+v, created %s", habits[0].Completions, want)
	}
}

func jsonOf(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestADayCanBeCheckedOffOnce(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)
	a.checkOffDay(alice, h.Id, `{"date":"`+dateString(0)+`"}`)

	w := a.checkOffDay(alice, h.Id, `{"date":"`+dateString(0)+`"}`)

	if w.Code != http.StatusConflict || errorOf(t, w) != "Habit already completed for this date" {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

func TestADayInTheFutureCannotBeCheckedOff(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)

	w := a.checkOffDay(alice, h.Id, `{"date":"`+dateString(-1)+`"}`)

	if w.Code != http.StatusBadRequest || errorOf(t, w) != "Cannot mark completions for future dates" {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
	if list := a.listCompletions(alice, h.Id, ""); len(list) != 0 {
		t.Errorf("stored %+v", list)
	}
}

func TestABlankNoteIsNoNote(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)

	w := a.checkOffDay(alice, h.Id, `{"date":"`+dateString(0)+`","notes":"   "}`)
	if got := decode[api.Completion](t, w); got.Notes != nil {
		t.Errorf("created with %q", *got.Notes)
	}
	for _, body := range []string{`{"notes":null}`, `{"notes":""}`, `{"notes":"  "}`, `{}`} {
		a.as(alice, http.MethodPut, completionsPath(h.Id)+"/"+dateString(0), `{"notes":"Hilly"}`)
		w := a.as(alice, http.MethodPut, completionsPath(h.Id)+"/"+dateString(0), body)
		if got := decode[api.Completion](t, w); w.Code != http.StatusOK || got.Notes != nil {
			t.Errorf("%s: got %d %+v", body, w.Code, got)
		}
	}
}

func TestANoteCanBeSetOnACheckedOffDay(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)
	created := decode[api.Completion](t, a.checkOffDay(alice, h.Id, `{"date":"`+dateString(2)+`"}`))

	w := a.as(alice, http.MethodPut, completionsPath(h.Id)+"/"+dateString(2), `{"notes":" Hilly "}`)

	got := decode[api.Completion](t, w)
	if w.Code != http.StatusOK || got.Id != created.Id || got.Notes == nil || *got.Notes != "Hilly" {
		t.Errorf("got %d %+v", w.Code, got)
	}
}

func TestADayNotCheckedOffHasNoNoteAndCannotBeUnchecked(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)
	a.checkOffDay(alice, h.Id, `{"date":"`+dateString(0)+`"}`)

	for method, body := range map[string]string{http.MethodPut: `{"notes":"x"}`, http.MethodDelete: ""} {
		w := a.as(alice, method, completionsPath(h.Id)+"/"+dateString(1), body)
		if w.Code != http.StatusNotFound || errorOf(t, w) != "Completion not found" {
			t.Errorf("%s: got %d %s", method, w.Code, w.Body)
		}
	}
}

func TestUncheckingADayRemovesOnlyThatDay(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)
	a.checkOffDay(alice, h.Id, `{"date":"`+dateString(0)+`"}`)
	a.checkOffDay(alice, h.Id, `{"date":"`+dateString(1)+`"}`)

	w := a.as(alice, http.MethodDelete, completionsPath(h.Id)+"/"+dateString(0), "")

	got := decode[api.CompletionDeleted](t, w)
	if w.Code != http.StatusOK || got.Message != "Completion deleted successfully" ||
		got.HabitId != h.Id.String() || got.Date.String() != dateString(0) {
		t.Errorf("got %d %+v", w.Code, got)
	}
	if list := a.listCompletions(alice, h.Id, ""); len(list) != 1 || list[0].Date.String() != dateString(1) {
		t.Errorf("left %+v", list)
	}
}

func TestCompletionsAreListedNewestFirstWithinTheDatesGiven(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)
	for _, ago := range []int{3, 0, 4, 1, 2} {
		a.checkOffDay(alice, h.Id, `{"date":"`+dateString(ago)+`"}`)
	}

	for query, want := range map[string][]int{
		"":                            {0, 1, 2, 3, 4},
		"?startDate=" + dateString(2): {0, 1, 2},
		"?endDate=" + dateString(2):   {2, 3, 4},
		"?startDate=" + dateString(3) + "&endDate=" + dateString(1): {1, 2, 3},
		"?startDate=" + dateString(1) + "&endDate=" + dateString(1): {1},
		"?startDate=" + dateString(1) + "&endDate=" + dateString(3): {},
	} {
		var got []int
		for _, c := range a.listCompletions(alice, h.Id, query) {
			got = append(got, int(today().Sub(c.Date.Time).Hours()/24))
		}
		if !slices.Equal(got, want) && !(len(got) == 0 && len(want) == 0) {
			t.Errorf("%q: %v days ago, want %v", query, got, want)
		}
	}
}

// A date that cannot be one is a 400 in the completion routes' Error shape,
// wherever it is sent: path, query or body.
func TestAnImpossibleDateIs400(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)

	for _, date := range []string{"2026-02-30", "2026-13-01", "26-01-01", "yesterday"} {
		for _, tc := range []struct{ method, target, body string }{
			{http.MethodPost, completionsPath(h.Id), `{"date":"` + date + `"}`},
			{http.MethodPut, completionsPath(h.Id) + "/" + date, `{"notes":"x"}`},
			{http.MethodDelete, completionsPath(h.Id) + "/" + date, ""},
			{http.MethodGet, completionsPath(h.Id) + "?startDate=" + date, ""},
			{http.MethodGet, completionsPath(h.Id) + "?endDate=" + date, ""},
		} {
			w := a.as(alice, tc.method, tc.target, tc.body)
			if w.Code != http.StatusBadRequest || errorOf(t, w) == "" {
				t.Errorf("%s %s %s: got %d %s", tc.method, tc.target, tc.body, w.Code, w.Body)
			}
		}
	}
}

func TestCompletionStoreFailuresAre500sWithoutDetail(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)
	a.store.err = errDatabaseDown

	for _, tc := range []struct{ method, target, body string }{
		{http.MethodGet, completionsPath(h.Id), ""},
		{http.MethodPost, completionsPath(h.Id), `{"date":"` + dateString(0) + `"}`},
		{http.MethodPut, completionsPath(h.Id) + "/" + dateString(0), `{"notes":"x"}`},
		{http.MethodDelete, completionsPath(h.Id) + "/" + dateString(0), ""},
	} {
		w := a.as(alice, tc.method, tc.target, tc.body)
		if w.Code != http.StatusInternalServerError || errorOf(t, w) != "Internal server error" ||
			strings.Contains(w.Body.String(), errDatabaseDown.Error()) {
			t.Errorf("%s %s: got %d %s", tc.method, tc.target, w.Code, w.Body)
		}
	}
}

func rangePath(from, to int) string {
	return "/api/v1/completions?startDate=" + dateString(from) + "&endDate=" + dateString(to)
}

func (a *app) listCompletionsInRange(u testUser, from, to int) []api.HabitCompletions {
	a.t.Helper()
	w := a.as(u, http.MethodGet, rangePath(from, to), "")
	if w.Code != http.StatusOK {
		a.t.Fatalf("list completions in a range: %d %s", w.Code, w.Body)
	}
	return decode[[]api.HabitCompletions](a.t, w)
}

func TestARangeListsEveryHabitOldestFirstWithItsDaysNewestFirst(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	run := a.createHabit(alice, `{"name":"Run"}`)
	read := a.createHabit(alice, `{"name":"Read","status":"archived"}`)
	stretch := a.createHabit(alice, `{"name":"Stretch"}`)
	for _, ago := range []int{7, 6, 0, 1} {
		a.checkOffDay(alice, run.Id, `{"date":"`+dateString(ago)+`"}`)
	}
	created := decode[api.Completion](t, a.checkOffDay(alice, read.Id, `{"date":"`+dateString(3)+`","notes":"ch. 4"}`))

	got := a.listCompletionsInRange(alice, 6, 0)

	var ids []uuid.UUID
	for _, entry := range got {
		ids = append(ids, entry.HabitId)
	}
	if !slices.Equal(ids, []uuid.UUID{run.Id, read.Id, stretch.Id}) {
		t.Fatalf("habits %v", ids)
	}
	var runDays []int
	for _, c := range got[0].Completions {
		runDays = append(runDays, int(today().Sub(c.Date.Time).Hours()/24))
	}
	if !slices.Equal(runDays, []int{0, 1, 6}) {
		t.Errorf("Run's days ago %v", runDays)
	}
	// One entity, one wire shape (habitcraft-34d.1).
	if len(got[1].Completions) != 1 || jsonOf(t, got[1].Completions[0]) != jsonOf(t, created) {
		t.Errorf("Read %+v, created %+v", got[1].Completions, created)
	}
	if got[2].Completions == nil || len(got[2].Completions) != 0 {
		t.Errorf("Stretch %#v, want an empty list", got[2].Completions)
	}
}

func TestARangeShowsOnlyTheCallersHabits(t *testing.T) {
	a := newApp(t)
	alice, bob := a.newUser(), a.newUser()
	run := a.createHabit(alice, `{"name":"Run"}`)
	a.checkOffDay(alice, run.Id, `{"date":"`+dateString(0)+`"}`)

	if got := a.listCompletionsInRange(bob, 6, 0); len(got) != 0 {
		t.Errorf("Bob sees %+v", got)
	}
}

func TestARangeIsAtMostMaxRangeDays(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()

	if w := a.as(alice, http.MethodGet, rangePath(maxRangeDays-1, 0), ""); w.Code != http.StatusOK {
		t.Errorf("the longest range: got %d %s", w.Code, w.Body)
	}
	if w := a.as(alice, http.MethodGet, rangePath(0, 0), ""); w.Code != http.StatusOK {
		t.Errorf("a single day: got %d %s", w.Code, w.Body)
	}
	for target, want := range map[string]string{
		rangePath(maxRangeDays, 0): fmt.Sprintf("The range can be at most %d days", maxRangeDays),
		rangePath(0, 1):            "endDate must not be before startDate",
	} {
		w := a.as(alice, http.MethodGet, target, "")
		if w.Code != http.StatusBadRequest || errorOf(t, w) != want {
			t.Errorf("%s: got %d %s", target, w.Code, w.Body)
		}
	}
}

// Both dates are required and must be dates; the validation middleware
// refuses anything else in the completion routes' Error shape.
func TestARangeNeedsTwoRealDates(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()

	for _, query := range []string{
		"",
		"?startDate=" + dateString(1),
		"?endDate=" + dateString(1),
		"?startDate=2026-02-30&endDate=" + dateString(0),
		"?startDate=" + dateString(1) + "&endDate=yesterday",
	} {
		w := a.as(alice, http.MethodGet, "/api/v1/completions"+query, "")
		if w.Code != http.StatusBadRequest || errorOf(t, w) == "" {
			t.Errorf("%q: got %d %s", query, w.Code, w.Body)
		}
	}
}

func TestARangeNeedsSigningIn(t *testing.T) {
	a := newApp(t)

	if w := a.do(http.MethodGet, rangePath(1, 0), ""); w.Code != http.StatusUnauthorized {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

func TestARangeStoreFailureIs500WithoutDetail(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	a.store.err = errDatabaseDown

	w := a.as(alice, http.MethodGet, rangePath(1, 0), "")

	if w.Code != http.StatusInternalServerError || errorOf(t, w) != "Internal server error" ||
		strings.Contains(w.Body.String(), errDatabaseDown.Error()) {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}
