package habitcraft

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/adamwolfers/habitcraft/server/api"
)

func (a *app) updateProfile(u testUser, body string) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.as(u, http.MethodPut, "/api/v1/users/me", body)
}

func (a *app) deleteAccount(u testUser, body string) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.as(u, http.MethodDelete, "/api/v1/users/me", body)
}

func TestAProfileUpdateChangesWhatItSends(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	before := decode[api.User](t, a.me(bearer(alice.token)))
	email := "Alice.Jones-" + alice.id.String() + "@Example.com"

	w := a.updateProfile(alice, `{"name":"  Alice Jones  "}`)
	if got := decode[api.User](t, w); w.Code != http.StatusOK || got.Name != "Alice Jones" || got.Email != before.Email {
		t.Errorf("name only: %d %+v", w.Code, got)
	}
	w = a.updateProfile(alice, `{"email":"`+email+`"}`)
	got := decode[api.User](t, w)
	if w.Code != http.StatusOK || string(got.Email) != strings.ToLower(email) || got.Name != "Alice Jones" ||
		got.Id != alice.id || !got.CreatedAt.Equal(before.CreatedAt) {
		t.Errorf("email only: %d %+v", w.Code, got)
	}
	if w := a.login(strings.ToLower(email), alicePassword); w.Code != http.StatusOK {
		t.Errorf("signing in with the new email: %d %s", w.Code, w.Body)
	}
}

func TestAProfileUpdateNeedsSomethingToChange(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()

	w := a.updateProfile(alice, `{}`)

	got := decode[api.ValidationErrors](t, w)
	if w.Code != http.StatusBadRequest || len(got.Errors) != 1 || got.Errors[0].Msg != "At least one field (name or email) is required" {
		t.Errorf("got %d %+v", w.Code, got)
	}
}

func TestANameOfOnlySpacesIsRefusedOnUpdate(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()

	w := a.updateProfile(alice, `{"name":"   "}`)

	got := decode[api.ValidationErrors](t, w)
	if w.Code != http.StatusBadRequest || len(got.Errors) != 1 || got.Errors[0].Msg != "Name is required" || *got.Errors[0].Path != "name" {
		t.Errorf("got %d %+v", w.Code, got)
	}
}

func TestAnEmailInUseCannotBeTaken(t *testing.T) {
	a := newApp(t)
	bob := a.register("bob@example.com")
	alice := a.newUser()

	w := a.updateProfile(alice, `{"email":"BOB@example.com"}`)
	if w.Code != http.StatusConflict || errorOf(t, w) != "Email is already in use" {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
	if w := a.me(bearer(bob.AccessToken)); decode[api.User](t, w).Email != "bob@example.com" {
		t.Errorf("bob's profile changed: %s", w.Body)
	}
}

func TestAUserCanKeepTheirOwnEmail(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	email := decode[api.User](t, a.me(bearer(alice.token))).Email

	if w := a.updateProfile(alice, `{"email":"`+string(email)+`","name":"Alice"}`); w.Code != http.StatusOK {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

func TestAProfileUpdateForAMissingUserIs404(t *testing.T) {
	a := newApp(t)
	ghost := testUser{token: accessTokenFor(t, uuid.New())}

	if w := a.updateProfile(ghost, `{"name":"Ghost"}`); w.Code != http.StatusNotFound || errorOf(t, w) != "User not found" {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

func TestDeletingAnAccountNeedsItsPassword(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()

	for body, want := range map[string]struct {
		code    int
		message string
	}{
		`{"password":""}`:      {http.StatusBadRequest, "Password confirmation required"},
		`{"password":"wrong"}`: {http.StatusUnauthorized, "Invalid password"},
	} {
		w := a.deleteAccount(alice, body)
		if w.Code != want.code || errorOf(t, w) != want.message {
			t.Errorf("%s: got %d %s", body, w.Code, w.Body)
		}
	}
	if w := a.me(bearer(alice.token)); w.Code != http.StatusOK {
		t.Errorf("the account went anyway: %d", w.Code)
	}
}

func TestADeletedAccountTakesEverythingWithIt(t *testing.T) {
	a := newApp(t)
	auth := a.register("alice@example.com")
	alice := testUser{id: auth.User.Id, token: auth.AccessToken}
	h := a.createHabit(alice, `{"name":"Run"}`)
	a.checkOffDay(alice, h.Id, `{"date":"`+dateString(0)+`"}`)
	bob := a.newUser()
	a.createHabit(bob, `{"name":"Read"}`)

	if w := a.deleteAccount(alice, `{"password":"`+alicePassword+`"}`); w.Code != http.StatusNoContent || w.Body.Len() != 0 {
		t.Fatalf("delete: %d %s", w.Code, w.Body)
	}

	if w := a.me(bearer(alice.token)); w.Code != http.StatusNotFound {
		t.Errorf("profile afterwards: %d", w.Code)
	}
	if w := a.login("alice@example.com", alicePassword); w.Code != http.StatusUnauthorized {
		t.Errorf("signing in afterwards: %d", w.Code)
	}
	if w := a.refresh(auth.RefreshToken); w.Code != http.StatusUnauthorized {
		t.Errorf("refreshing afterwards: %d", w.Code)
	}
	if habits, _ := a.store.habits(t.Context(), alice.id, "", daysAgo(1)); len(habits) != 0 {
		t.Errorf("habits left: %+v", habits)
	}
	if got := a.listHabits(bob, ""); len(got) != 1 {
		t.Errorf("bob's habits: %+v", got)
	}
	if w := a.deleteAccount(alice, `{"password":"`+alicePassword+`"}`); w.Code != http.StatusNotFound {
		t.Errorf("deleting again: %d %s", w.Code, w.Body)
	}
}

func TestProfileStoreFailuresAre500sWithoutDetail(t *testing.T) {
	a := newApp(t)
	alice := a.newUser()
	a.store.err = errors.New("connection refused to 10.0.0.5")

	for _, w := range []*httptest.ResponseRecorder{
		a.updateProfile(alice, `{"name":"Alice"}`),
		a.deleteAccount(alice, `{"password":"`+alicePassword+`"}`),
	} {
		if w.Code != http.StatusInternalServerError || strings.Contains(w.Body.String(), "10.0.0.5") {
			t.Errorf("got %d %s", w.Code, w.Body)
		}
	}
}
