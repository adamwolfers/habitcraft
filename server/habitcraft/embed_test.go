package habitcraft_test

// The acceptance test for embedding (habitcraft-vxln.6). It is a host
// application: it sees only the package's exported API, gives HabitCraft a
// Postgres schema of its own, migrates it, mounts the handler under a prefix
// beside a route of its own, and listens for completion events while a user
// works through the API over real HTTP.

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adamwolfers/habitcraft/server/habitcraft"
)

func TestAHostAppEmbedsHabitCraft(t *testing.T) {
	host := newHostApp(t)

	if body := host.get(t, "/hello"); body != "the host's own route" {
		t.Errorf("host route answered %q", body)
	}

	alice := host.register(t)
	habit := host.createHabit(t, alice, "Run")
	today := time.Now().UTC().Format(time.DateOnly)

	host.expect(t, alice, http.MethodPost, "/habits/"+habit+"/completions",
		`{"date":"`+today+`","notes":"5k"}`, http.StatusCreated)
	host.expect(t, alice, http.MethodPut, "/habits/"+habit+"/completions/"+today,
		`{"notes":"10k"}`, http.StatusOK)
	host.expect(t, alice, http.MethodDelete, "/habits/"+habit+"/completions/"+today,
		"", http.StatusOK)

	// Requests that change nothing tell the host nothing.
	host.expect(t, alice, http.MethodDelete, "/habits/"+habit+"/completions/"+today,
		"", http.StatusNotFound)
	host.expect(t, alice, http.MethodPost, "/habits/"+habit+"/completions",
		`{"date":"`+today+`"}`, http.StatusCreated)
	host.expect(t, alice, http.MethodPost, "/habits/"+habit+"/completions",
		`{"date":"`+today+`"}`, http.StatusConflict)

	// Deleting the habit takes its completion with it, silently.
	host.expect(t, alice, http.MethodDelete, "/habits/"+habit, "", http.StatusNoContent)

	ten := "10k"
	five := "5k"
	want := []habitcraft.CompletionEvent{
		{Kind: habitcraft.Completed, Notes: &five},
		{Kind: habitcraft.NoteChanged, Notes: &ten},
		{Kind: habitcraft.Uncompleted},
		{Kind: habitcraft.Completed},
	}
	got := host.events()
	if len(got) != len(want) {
		t.Fatalf("got %d events, want %d: %+v", len(got), len(want), got)
	}
	for i, e := range got {
		w := want[i]
		if e.Kind != w.Kind || !sameNotes(e.Notes, w.Notes) {
			t.Errorf("event %d: %v notes %v, want %v notes %v", i, e.Kind, deref(e.Notes), w.Kind, deref(w.Notes))
		}
		if e.UserID.String() != alice.id || e.HabitID.String() != habit || e.Date.Format(time.DateOnly) != today {
			t.Errorf("event %d is about user %s habit %s on %s", i, e.UserID, e.HabitID, e.Date)
		}
		if time.Since(e.At) > time.Minute || e.At.After(time.Now()) {
			t.Errorf("event %d happened at %s", i, e.At)
		}
	}
}

// A hostApp is an application that embeds HabitCraft under /habitcraft.
type hostApp struct {
	url string

	mu       sync.Mutex
	received []habitcraft.CompletionEvent
}

const prefix = "/habitcraft"

func newHostApp(t *testing.T) *hostApp {
	t.Helper()
	pool := ownSchema(t)
	if _, err := habitcraft.Migrate(t.Context(), pool); err != nil {
		t.Fatal(err)
	}
	host := &hostApp{}
	server, err := habitcraft.New(habitcraft.Config{
		DB:                  pool,
		JWTSecret:           []byte(strings.Repeat("s", 32)),
		InsecureCookies:     true,
		DisableRateLimiting: true,
		OnCompletion: func(_ context.Context, e habitcraft.CompletionEvent) {
			host.mu.Lock()
			defer host.mu.Unlock()
			host.received = append(host.received, e)
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	handler, err := server.Handler()
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/hello", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "the host's own route")
	})
	mux.Handle(prefix+"/", http.StripPrefix(prefix, handler))
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	host.url = srv.URL
	return host
}

func (h *hostApp) events() []habitcraft.CompletionEvent {
	h.mu.Lock()
	defer h.mu.Unlock()
	return slices.Clone(h.received)
}

type hostUser struct{ id, token string }

func (h *hostApp) register(t *testing.T) hostUser {
	t.Helper()
	body := h.call(t, hostUser{}, http.MethodPost, "/auth/register",
		`{"email":"host-`+uuid.NewString()+`@example.com","password":"Correct-Horse-1","name":"Alice"}`, http.StatusCreated)
	var auth struct {
		User        struct{ ID string }
		AccessToken string
	}
	if err := json.Unmarshal(body, &auth); err != nil {
		t.Fatal(err)
	}
	return hostUser{id: auth.User.ID, token: auth.AccessToken}
}

func (h *hostApp) createHabit(t *testing.T, u hostUser, name string) string {
	t.Helper()
	body := h.call(t, u, http.MethodPost, "/habits", `{"name":"`+name+`"}`, http.StatusCreated)
	var habit struct{ ID string }
	if err := json.Unmarshal(body, &habit); err != nil {
		t.Fatal(err)
	}
	return habit.ID
}

func (h *hostApp) expect(t *testing.T, u hostUser, method, path, body string, status int) {
	t.Helper()
	h.call(t, u, method, path, body, status)
}

// call makes a request to an API path, under the prefix the host mounted it
// at, and fails the test on any other status.
func (h *hostApp) call(t *testing.T, u hostUser, method, path, body string, status int) []byte {
	t.Helper()
	r, err := http.NewRequestWithContext(t.Context(), method, h.url+prefix+"/api/v1"+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	if u.token != "" {
		r.Header.Set("Authorization", "Bearer "+u.token)
	}
	resp, err := http.DefaultClient.Do(r)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != status {
		t.Fatalf("%s %s: %d %s, want %d", method, path, resp.StatusCode, out, status)
	}
	return out
}

func (h *hostApp) get(t *testing.T, path string) string {
	t.Helper()
	resp, err := http.Get(h.url + path)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(resp.Body)
	return string(out)
}

// ownSchema is how the README tells a host to keep HabitCraft's tables apart
// from its own: a Postgres schema of HabitCraft's, first on the pool's search
// path. public follows it for the uuid-ossp functions. It needs
// HABITCRAFT_TEST_DATABASE_URL, as the store tests do.
func ownSchema(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("HABITCRAFT_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("HABITCRAFT_TEST_DATABASE_URL is not set")
	}
	name := "embed_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	admin, err := pgxpool.New(t.Context(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	if _, err := admin.Exec(t.Context(), "CREATE SCHEMA "+name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.Exec(context.Background(), "DROP SCHEMA "+name+" CASCADE") })

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = fmt.Sprintf("%s, public", name)
	pool, err := pgxpool.NewWithConfig(t.Context(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func sameNotes(a, b *string) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}

func deref(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}
