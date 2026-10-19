package habitcraft

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/adamwolfers/habitcraft/server/api"
)

// A user is a registered account and its access token.
type testUser struct {
	id    uuid.UUID
	token string
}

func (a *app) newUser() testUser {
	a.t.Helper()
	auth := a.register("user-" + uuid.NewString() + "@example.com")
	return testUser{id: auth.User.Id, token: auth.AccessToken}
}

func (a *app) as(u testUser, method, target, body string) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.do(method, target, body, bearer(u.token))
}

// createHabit makes a habit through the API and returns it.
func (a *app) createHabit(u testUser, body string) api.Habit {
	a.t.Helper()
	w := a.as(u, http.MethodPost, "/api/v1/habits", body)
	if w.Code != http.StatusCreated {
		a.t.Fatalf("create habit: %d %s", w.Code, w.Body)
	}
	return decode[api.Habit](a.t, w)
}

func (a *app) listHabits(u testUser, query string) []api.HabitWithCompletions {
	a.t.Helper()
	w := a.as(u, http.MethodGet, "/api/v1/habits"+query, "")
	if w.Code != http.StatusOK {
		a.t.Fatalf("list habits: %d %s", w.Code, w.Body)
	}
	return decode[[]api.HabitWithCompletions](a.t, w)
}

func habitPath(id uuid.UUID) string {
	return "/api/v1/habits/" + id.String()
}

func detailedErrorOf(t *testing.T, w *httptest.ResponseRecorder) api.DetailedError {
	t.Helper()
	return decode[api.DetailedError](t, w)
}

func TestAHabitIsCreatedWithDefaults(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()

	h := a.createHabit(alice, `{"name":"  Morning run  "}`)

	if h.Name != "Morning run" || h.UserId != alice.id || h.Description != nil ||
		h.Color != defaultColor || h.Icon != defaultIcon || h.Status != "active" {
		t.Errorf("got %+v", h)
	}
	if h.CreatedAt.IsZero() || !h.UpdatedAt.Equal(h.CreatedAt) {
		t.Errorf("timestamps %v and %v", h.CreatedAt, h.UpdatedAt)
	}
}

func TestAHabitIsCreatedAsDescribed(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()

	h := a.createHabit(alice, `{"name":"Read","description":" Ten pages ","color":"#AABBCC","icon":"📚","status":"archived"}`)

	if h.Description == nil || *h.Description != "Ten pages" || h.Color != "#AABBCC" || h.Icon != "📚" || h.Status != "archived" {
		t.Errorf("got %+v", h)
	}
}

func TestAHabitNeedsANameThatIsNotBlank(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)

	for method, target := range map[string]string{http.MethodPost: "/api/v1/habits", http.MethodPut: habitPath(h.Id)} {
		w := a.as(alice, method, target, `{"name":"   "}`)
		got := detailedErrorOf(t, w)
		if w.Code != http.StatusBadRequest || got.Message != "name is required and must be a non-empty string" || got.StatusCode != 400 {
			t.Errorf("%s: got %d %+v", method, w.Code, got)
		}
	}
}

// The spec gives icon no maximum, but the column holds ten characters. Ten
// is fine whatever their size in bytes; eleven is a 400, not a 500.
func TestAnIconFitsItsColumn(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()

	a.createHabit(alice, `{"name":"Run","icon":"`+strings.Repeat("🏃", maxIconLength)+`"}`)
	w := a.as(alice, http.MethodPost, "/api/v1/habits", `{"name":"Run","icon":"`+strings.Repeat("🏃", maxIconLength+1)+`"}`)
	if w.Code != http.StatusBadRequest || detailedErrorOf(t, w).Message != "icon must not exceed 10 characters" {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

func TestAUserHasAtMostTheHabitLimit(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	for i := range maxHabitsPerUser {
		if _, err := a.store.createHabit(t.Context(), newHabit(alice.id, "Habit"), maxHabitsPerUser); err != nil {
			t.Fatalf("habit %d: %v", i, err)
		}
	}

	w := a.as(alice, http.MethodPost, "/api/v1/habits", `{"name":"One too many"}`)

	got := decode[api.BriefError](t, w)
	if w.Code != http.StatusForbidden || got.Error != "Habit limit reached" || !strings.Contains(got.Message, "maximum of 50 habits") {
		t.Errorf("got %d %+v", w.Code, got)
	}
}

func TestHabitsAreListedOldestFirstAndByStatus(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	a.createHabit(alice, `{"name":"Run"}`)
	a.createHabit(alice, `{"name":"Read","status":"archived"}`)
	a.createHabit(alice, `{"name":"Write"}`)

	for query, want := range map[string][]string{
		"":                 {"Run", "Read", "Write"},
		"?status=active":   {"Run", "Write"},
		"?status=archived": {"Read"},
	} {
		var names []string
		for _, h := range a.listHabits(alice, query) {
			names = append(names, h.Name)
		}
		if !slices.Equal(names, want) {
			t.Errorf("%q: %v, want %v", query, names, want)
		}
	}
}

// GET /habits embeds a year and a day of completions, not every one ever
// recorded (habitcraft-172z); older ones are a habit's own completions list.
func TestHabitsEmbedTheLastYearAndADayOfCompletions(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)
	for _, ago := range []int{0, 1, embedDays - 1, embedDays} {
		checkOff(t, a.store, alice.id, h.Id, daysAgo(ago))
	}

	habits := a.listHabits(alice, "")

	if len(habits) != 1 {
		t.Fatalf("habits = %+v", habits)
	}
	var days []string
	for _, c := range habits[0].Completions {
		days = append(days, c.Date.String())
	}
	want := []string{dateString(0), dateString(1), dateString(embedDays - 1)}
	if !slices.Equal(days, want) {
		t.Errorf("embedded %v, want %v", days, want)
	}
	if w := a.as(alice, http.MethodGet, habitPath(h.Id)+"/completions", ""); len(decode[[]api.Completion](t, w)) != 4 {
		t.Errorf("the habit's own list should have all four: %s", w.Body)
	}
}

func TestAHabitWithNoCompletionsEmbedsAnEmptyList(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	a.createHabit(alice, `{"name":"Run"}`)

	w := a.as(alice, http.MethodGet, "/api/v1/habits", "")

	if !strings.Contains(w.Body.String(), `"completions":[]`) {
		t.Errorf("got %s", w.Body)
	}
}

func TestAnUpdateLeavesWhatItDoesNotSendAlone(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run","description":"Around the park","color":"#AABBCC","icon":"🏃"}`)

	w := a.as(alice, http.MethodPut, habitPath(h.Id), `{"name":"Jog"}`)

	got := decode[api.Habit](t, w)
	if w.Code != http.StatusOK || got.Name != "Jog" || got.Description == nil || *got.Description != "Around the park" ||
		got.Color != "#AABBCC" || got.Icon != "🏃" || got.Status != "active" {
		t.Errorf("got %d %+v", w.Code, got)
	}
	if got.UpdatedAt.Before(h.UpdatedAt) || !got.CreatedAt.Equal(h.CreatedAt) {
		t.Errorf("timestamps went from %v/%v to %v/%v", h.CreatedAt, h.UpdatedAt, got.CreatedAt, got.UpdatedAt)
	}
}

func TestADescriptionSentNullOrBlankIsCleared(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()

	for _, sent := range []string{`null`, `""`, `"   "`} {
		h := a.createHabit(alice, `{"name":"Run","description":"Around the park"}`)
		w := a.as(alice, http.MethodPut, habitPath(h.Id), `{"name":"Run","description":`+sent+`}`)
		if got := decode[api.Habit](t, w); w.Code != http.StatusOK || got.Description != nil {
			t.Errorf("description %s: got %d %+v", sent, w.Code, got)
		}
	}
}

func TestAHabitCanBeArchivedAndRestored(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)

	for _, status := range []api.HabitStatus{"archived", "active"} {
		w := a.as(alice, http.MethodPut, habitPath(h.Id), `{"name":"Run","status":"`+string(status)+`"}`)
		if got := decode[api.Habit](t, w); got.Status != status {
			t.Errorf("got %d %+v, want %s", w.Code, got, status)
		}
	}
}

func TestADeletedHabitIsGoneWithItsCompletions(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	run := a.createHabit(alice, `{"name":"Run"}`)
	read := a.createHabit(alice, `{"name":"Read"}`)
	checkOff(t, a.store, alice.id, run.Id, daysAgo(0))
	checkOff(t, a.store, alice.id, read.Id, daysAgo(0))

	if w := a.as(alice, http.MethodDelete, habitPath(run.Id), ""); w.Code != http.StatusNoContent || w.Body.Len() != 0 {
		t.Fatalf("delete: %d %s", w.Code, w.Body)
	}

	habits := a.listHabits(alice, "")
	if len(habits) != 1 || habits[0].Id != read.Id || len(habits[0].Completions) != 1 {
		t.Errorf("left %+v", habits)
	}
	for method, target := range map[string]string{
		http.MethodPut:    habitPath(run.Id),
		http.MethodDelete: habitPath(run.Id),
		http.MethodGet:    habitPath(run.Id) + "/completions",
	} {
		if w := a.as(alice, method, target, `{"name":"Run"}`); w.Code != http.StatusNotFound {
			t.Errorf("%s %s afterwards: %d %s", method, target, w.Code, w.Body)
		}
	}
}

// Another user's habit is a 404 on every route, in the shape the route
// documents, exactly as a habit that does not exist, never a 403: a caller
// cannot learn which habit ids exist. And nothing of the owner's changes.
func TestAnotherUsersHabitIsNotFound(t *testing.T) {
	a := newApp(t)
	alice, bob := a.newUser(), a.newUser()
	h := a.createHabit(alice, `{"name":"Run","description":"Alice's"}`)
	checkOff(t, a.store, alice.id, h.Id, daysAgo(0))
	today := dateString(0)

	for _, tc := range []struct {
		method, target, body string
		detailed             bool // the habits routes' DetailedError, else Error
		message              string
	}{
		{http.MethodPut, habitPath(h.Id), `{"name":"Bob's now"}`, true, "Habit not found"},
		{http.MethodDelete, habitPath(h.Id), "", true, "Habit not found"},
		{http.MethodGet, habitPath(h.Id) + "/completions", "", false, "Habit not found"},
		{http.MethodPost, habitPath(h.Id) + "/completions", `{"date":"` + dateString(1) + `"}`, false, "Habit not found"},
		{http.MethodPut, habitPath(h.Id) + "/completions/" + today, `{"notes":"Bob was here"}`, false, "Habit not found"},
		{http.MethodDelete, habitPath(h.Id) + "/completions/" + today, "", false, "Habit not found"},
	} {
		for who, id := range map[string]uuid.UUID{"another user's": h.Id, "a missing": uuid.New()} {
			target := strings.Replace(tc.target, h.Id.String(), id.String(), 1)
			w := a.as(bob, tc.method, target, tc.body)
			var message string
			if tc.detailed {
				message = detailedErrorOf(t, w).Error
			} else {
				message = errorOf(t, w)
			}
			if w.Code != http.StatusNotFound || message != tc.message {
				t.Errorf("%s %s for %s habit: got %d %s", tc.method, tc.target, who, w.Code, w.Body)
			}
		}
	}

	habits := a.listHabits(alice, "")
	if len(habits) != 1 || habits[0].Name != "Run" || *habits[0].Description != "Alice's" ||
		len(habits[0].Completions) != 1 || habits[0].Completions[0].Notes != nil {
		t.Errorf("alice's habit changed: %+v", habits)
	}
	if got := a.listHabits(bob, ""); len(got) != 0 {
		t.Errorf("bob lists %+v", got)
	}
}

// A habit id that is not a UUID never reaches a handler: each route answers
// 400 in its own documented shape.
func TestAMalformedHabitIDIs400(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()

	for _, id := range []string{"not-a-uuid", "123", "6b0552e6-abb4-4a64-aef7-f6461ee89a4", "6b0552e6abb44a64aef7f6461ee89a41x"} {
		for _, tc := range []struct {
			method, target, body string
			detailed             bool
		}{
			{http.MethodPut, "/api/v1/habits/" + id, `{"name":"Run"}`, true},
			{http.MethodDelete, "/api/v1/habits/" + id, "", true},
			{http.MethodGet, "/api/v1/habits/" + id + "/completions", "", false},
			{http.MethodPost, "/api/v1/habits/" + id + "/completions", `{"date":"2026-01-01"}`, false},
			{http.MethodPut, "/api/v1/habits/" + id + "/completions/2026-01-01", `{"notes":"x"}`, false},
			{http.MethodDelete, "/api/v1/habits/" + id + "/completions/2026-01-01", "", false},
		} {
			w := a.as(alice, tc.method, tc.target, tc.body)
			ok := w.Code == http.StatusBadRequest
			if tc.detailed {
				ok = ok && detailedErrorOf(t, w).StatusCode == 400
			} else {
				ok = ok && errorOf(t, w) != ""
			}
			if !ok {
				t.Errorf("%s %s: got %d %s", tc.method, tc.target, w.Code, w.Body)
			}
		}
	}
}

func TestHabitStoreFailuresAre500sInTheHabitShape(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)
	a.store.err = errDatabaseDown

	for method, target := range map[string]string{
		http.MethodGet:    "/api/v1/habits",
		http.MethodPost:   "/api/v1/habits",
		http.MethodPut:    habitPath(h.Id),
		http.MethodDelete: habitPath(h.Id),
	} {
		w := a.as(alice, method, target, `{"name":"Run"}`)
		got := detailedErrorOf(t, w)
		if w.Code != http.StatusInternalServerError || got.Error != "Internal server error" || got.StatusCode != 500 ||
			strings.Contains(w.Body.String(), errDatabaseDown.Error()) {
			t.Errorf("%s %s: got %d %s", method, target, w.Code, w.Body)
		}
	}
}

// errDatabaseDown carries a detail no response may repeat.
var errDatabaseDown = errors.New("connection refused to 10.0.0.5")

// dateString is the day n days before today as the API writes it.
func dateString(n int) string {
	return daysAgo(n).Format(time.DateOnly)
}
