package habitcraft

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adamwolfers/habitcraft/server/api"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

// hangingDB answers only when the probe gives up on it.
type hangingDB struct{}

func (hangingDB) Ping(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func testConfig() Config {
	return Config{JWTSecret: testSecret}
}

func serve(t *testing.T, db pinger, method, target, body string, edits ...func(*http.Request)) *httptest.ResponseRecorder {
	t.Helper()
	handler, err := newServer(db, newFakeStore(), testConfig()).Handler()
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(method, target, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	for _, edit := range edits {
		edit(r)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}

func decode[T any](t *testing.T, w *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatalf("decoding %q: %v", w.Body.String(), err)
	}
	return v
}

func TestNewRequiresADatabase(t *testing.T) {
	if _, err := New(Config{JWTSecret: testSecret}); err == nil {
		t.Fatal("New with no DB succeeded")
	}
}

func TestNewRequiresALongEnoughSecret(t *testing.T) {
	short := testSecret[:minSecretLength-1]
	if _, err := New(Config{DB: &pgxpool.Pool{}, JWTSecret: short}); err == nil {
		t.Fatalf("New with a %d-byte secret succeeded", len(short))
	}
}

func TestHealthyWhenTheDatabaseAnswers(t *testing.T) {
	before := time.Now().UTC().Add(-time.Second)

	w := serve(t, fakeDB{}, http.MethodGet, "/health", "")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	got := decode[api.Health](t, w)
	if got.Status != api.Healthy || got.Database != api.Connected || got.Service != serviceName {
		t.Errorf("health = %+v", got)
	}
	if got.Timestamp.Before(before) {
		t.Errorf("timestamp %v is stale", got.Timestamp)
	}
}

func TestUnhealthyWhenTheDatabaseDoesNot(t *testing.T) {
	w := serve(t, fakeDB{err: errors.New("connection refused")}, http.MethodGet, "/health", "")

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", w.Code)
	}
	got := decode[api.UnhealthyHealth](t, w)
	if got.Status != api.Unhealthy || got.Database != api.Disconnected || got.Error != "connection refused" {
		t.Errorf("health = %+v", got)
	}
}

func TestUnhealthyWhenTheDatabaseHangs(t *testing.T) {
	start := time.Now()

	w := serve(t, hangingDB{}, http.MethodGet, "/health", "")

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", w.Code)
	}
	if elapsed := time.Since(start); elapsed > healthTimeout+time.Second {
		t.Errorf("took %v, want the probe cut off at %v", elapsed, healthTimeout)
	}
}

func TestHello(t *testing.T) {
	w := serve(t, fakeDB{}, http.MethodGet, "/hello", "")

	if got := decode[api.Message](t, w); w.Code != http.StatusOK || got.Message != "Hello World!" {
		t.Errorf("got %d %+v", w.Code, got)
	}
}

func TestOperationsNotYetBuiltAnswer501(t *testing.T) {
	w := serve(t, fakeDB{}, http.MethodGet, "/api/v1/habits", "", bearer(accessTokenFor(t, uuid.New())))

	if w.Code != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", w.Code)
	}
}

func TestRequestsAreValidatedBeforeTheHandler(t *testing.T) {
	w := serve(t, fakeDB{}, http.MethodPost, "/api/v1/auth/register", `{}`)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	if got := decode[api.ValidationErrors](t, w); len(got.Errors) != 3 {
		t.Errorf("errors = %+v, want one per required field", got.Errors)
	}
}

func TestUnknownPathsAre404(t *testing.T) {
	if w := serve(t, fakeDB{}, http.MethodGet, "/api/v1/nope", ""); w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestHandlerErrorsAre500WithoutDetail(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/v1/habits", nil)

	newServer(fakeDB{}, newFakeStore(), testConfig()).serverError(w, r, errors.New("secret detail"))

	if w.Code != http.StatusInternalServerError || strings.Contains(w.Body.String(), "secret") {
		t.Errorf("got %d %s, want a 500 that hides the cause", w.Code, w.Body)
	}
}
