package habitcraft

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Users whose password the Node backend altered before hashing it
// (habitcraft-ti91). The public API cannot make one on this server, which
// hashes what it is sent, so each test stores the user the way the Node
// backend left them: a hash of nodeTransform(password).

const (
	legacyEmail    = "legacy@example.com"
	legacyPassword = "  p<b>ass</b>word&me >  " // Node hashed "password&me &gt;"
)

type legacyApp struct {
	*app
	logs *bytes.Buffer
	id   uuid.UUID
}

func newLegacyApp(t *testing.T) legacyApp {
	t.Helper()
	var logs bytes.Buffer
	a := newApp(t, func(c *Config) { c.Logger = slog.New(slog.NewJSONHandler(&logs, nil)) })
	id := uuid.New()
	_, err := a.store.createUser(context.Background(), user{
		id: id, email: legacyEmail, name: "Legacy", passwordHash: mustHash(t, nodeTransform(legacyPassword)),
	}, newSession(id))
	if err != nil {
		t.Fatal(err)
	}
	return legacyApp{app: a, logs: &logs, id: id}
}

func (a legacyApp) storedHash() string {
	a.t.Helper()
	u, err := a.store.userByID(context.Background(), a.id)
	if err != nil {
		a.t.Fatal(err)
	}
	return u.passwordHash
}

func (a legacyApp) token() testUser {
	return testUser{id: a.id, token: accessTokenFor(a.t, a.id)}
}

// assertLoggedFallback checks the fallback left one line saying so, naming
// the user by id. No line anywhere holds the password in either form or a
// hash, and the fallback's own lines do not hold the email either. (The
// existing success events log the email, as the Node backend's do.)
func (a legacyApp) assertLoggedFallback(operation string, hashes ...string) {
	a.t.Helper()
	logs := a.logs.String()
	var own []string
	for _, line := range strings.Split(logs, "\n") {
		if strings.Contains(line, "LEGACY_PASSWORD_MATCH") || strings.Contains(line, "legacy password") {
			own = append(own, line)
		}
	}
	matches := strings.Count(logs, `"event":"LEGACY_PASSWORD_MATCH"`)
	if matches != 1 || !strings.Contains(logs, `"operation":"`+operation+`"`) || !strings.Contains(own[0], a.id.String()) {
		a.t.Errorf("want one fallback line for %s, got %d: %s", operation, matches, logs)
	}
	for _, secret := range append(hashes, legacyPassword, nodeTransform(legacyPassword)) {
		if strings.Contains(logs, secret) {
			a.t.Errorf("the log holds %q: %s", secret, logs)
		}
	}
	for _, line := range own {
		if strings.Contains(line, legacyEmail) {
			a.t.Errorf("the fallback logged the email: %s", line)
		}
	}
}

func TestAPasswordNodeAlteredStillSignsIn(t *testing.T) {
	a := newLegacyApp(t)
	oldHash := a.storedHash()

	w := a.login(legacyEmail, legacyPassword)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	newHash := a.storedHash()
	if ok, _ := passwordMatches(newHash, legacyPassword); !ok {
		t.Error("the stored hash is not of the password as typed")
	}
	a.assertLoggedFallback("login", oldHash, newHash)

	// Repaired: the next sign-in needs no fallback.
	compares := countCompares(t)
	a.logs.Reset()
	if w := a.login(legacyEmail, legacyPassword); w.Code != http.StatusOK {
		t.Errorf("second login: %d %s", w.Code, w.Body)
	}
	if *compares != 1 || strings.Contains(a.logs.String(), "LEGACY_PASSWORD_MATCH") {
		t.Errorf("second login took %d compares; logs %s", *compares, a.logs)
	}
}

func TestTheFallbackDoesNotLetAWrongPasswordIn(t *testing.T) {
	a := newLegacyApp(t)
	oldHash := a.storedHash()

	// Anything Node would have turned into the stored form opens the
	// account, as it did on Node, but nothing else does.
	for _, wrong := range []string{"password&me", "Wrong<b>Horse", "Wrong-Horse-1"} {
		if w := a.login(legacyEmail, wrong); w.Code != http.StatusUnauthorized {
			t.Errorf("%q: got %d %s", wrong, w.Code, w.Body)
		}
	}
	if a.storedHash() != oldHash {
		t.Error("a failed login changed the stored hash")
	}
	if strings.Contains(a.logs.String(), "LEGACY_PASSWORD_MATCH") {
		t.Errorf("logged a match: %s", a.logs)
	}
}

// Only a password the transform changes gets a second compare; any other
// wrong password costs exactly what it did before the fallback existed.
func TestAPasswordTheTransformLeavesAloneIsComparedOnce(t *testing.T) {
	a := newLegacyApp(t)
	compares := countCompares(t)

	a.login(legacyEmail, "Wrong-Horse-1")

	if *compares != 1 {
		t.Errorf("%d compares, want 1", *compares)
	}
}

// The second compare must not make a registered email slower to refuse than
// an unknown one.
func TestAnUnknownEmailCostsWhatAWrongPasswordDoes(t *testing.T) {
	a := newLegacyApp(t)
	compares := countCompares(t)
	for _, password := range []string{"Wrong<b>Horse", "Wrong-Horse-1"} {
		before := *compares
		a.login(legacyEmail, password)
		known := *compares - before

		before = *compares
		a.login("nobody@example.com", password)
		unknown := *compares - before

		if known != unknown {
			t.Errorf("%q: %d compares for a real account, %d for an unknown email", password, known, unknown)
		}
	}
}

// The user already proved who they are; a database hiccup while repairing the
// hash is no reason to turn them away. The next sign-in tries again.
func TestAFailedRehashStillSignsIn(t *testing.T) {
	t.Run("the write fails", func(t *testing.T) {
		a := newLegacyApp(t)
		oldHash := a.storedHash()
		a.store.replacePasswordHashErr = errors.New("connection reset")

		if w := a.login(legacyEmail, legacyPassword); w.Code != http.StatusOK {
			t.Fatalf("got %d %s", w.Code, w.Body)
		}
		if a.storedHash() != oldHash {
			t.Error("the hash changed")
		}
		if !strings.Contains(a.logs.String(), "connection reset") {
			t.Errorf("the failure was not logged: %s", a.logs)
		}
		a.assertLoggedFallback("login", oldHash)
	})
	t.Run("hashing fails", func(t *testing.T) {
		a := newLegacyApp(t)
		cost := passwordCost
		passwordCost = bcrypt.MaxCost + 1
		t.Cleanup(func() { passwordCost = cost })

		if w := a.login(legacyEmail, legacyPassword); w.Code != http.StatusOK {
			t.Fatalf("got %d %s", w.Code, w.Body)
		}
		if !strings.Contains(a.logs.String(), "could not replace a legacy password hash") {
			t.Errorf("the failure was not logged: %s", a.logs)
		}
	})
}

// Changing the password replaces the hash anyway, so the fallback only has to
// accept the current password.
func TestALegacyPasswordCanBeChanged(t *testing.T) {
	a := newLegacyApp(t)

	w := a.changePassword(a.token().token, legacyPassword, newPassword, newPassword)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	if ok, _ := passwordMatches(a.storedHash(), newPassword); !ok {
		t.Error("the new password was not stored")
	}
	a.assertLoggedFallback("change_password")
	if w := a.changePassword(a.token().token, "password&me", newPassword, newPassword); w.Code != http.StatusUnauthorized {
		t.Errorf("a wrong current password: %d %s", w.Code, w.Body)
	}
}

func TestALegacyAccountCanBeDeleted(t *testing.T) {
	a := newLegacyApp(t)

	if w := a.deleteAccount(a.token(), `{"password":"password&me"}`); w.Code != http.StatusUnauthorized {
		t.Errorf("a wrong password: %d %s", w.Code, w.Body)
	}
	if w := a.deleteAccount(a.token(), `{"password":"`+legacyPassword+`"}`); w.Code != http.StatusNoContent {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	a.assertLoggedFallback("delete_account")
}
