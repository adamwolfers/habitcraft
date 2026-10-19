package habitcraft

import (
	"encoding/json"
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
