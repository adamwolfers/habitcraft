package habitcraft

import (
	"maps"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adamwolfers/habitcraft/server/internal/api"
)

// clock is a time a test moves by hand.
type clock struct{ t time.Time }

func (c *clock) now() time.Time           { return c.t }
func (c *clock) advance(by time.Duration) { c.t = c.t.Add(by) }

// limitedApp is newApp with rate limiting on, and its clock in the test's hands.
func limitedApp(t *testing.T, edits ...func(*Config)) (*app, *clock) {
	t.Helper()
	cfg := testConfig()
	cfg.DisableRateLimiting = false
	for _, edit := range edits {
		edit(&cfg)
	}
	c := &clock{t: time.Date(2026, 11, 7, 12, 0, 0, 0, time.UTC)}
	st := newFakeStore()
	s := newServer(fakeDB{}, st, cfg)
	s.limiter.now = c.now
	handler, err := s.Handler()
	if err != nil {
		t.Fatal(err)
	}
	return &app{t: t, handler: handler, store: st}, c
}

func fromAddress(addr string) func(*http.Request) {
	return func(r *http.Request) { r.RemoteAddr = addr }
}

// A limited operation, and a request to it that the limiter counts. The bodies
// are empty, so validation refuses them: the limiter runs first, as Node's does,
// and counts a request whatever becomes of it.
type limitedOperation struct {
	operationID    string
	method, target string
	authenticated  bool
	max            int
	window         time.Duration
	error, message string
}

var limitedOperations = []limitedOperation{
	{"Register", http.MethodPost, "/api/v1/auth/register", false, 10, time.Hour,
		"Too many registration attempts", "Too many accounts created from this IP, please try again after an hour"},
	{"Login", http.MethodPost, "/api/v1/auth/login", false, 15, 15 * time.Minute,
		"Too many login attempts", "Too many login attempts from this IP, please try again after 15 minutes"},
	{"RefreshToken", http.MethodPost, "/api/v1/auth/refresh", false, 30, 15 * time.Minute,
		"Too many refresh attempts", "Too many token refresh attempts from this IP, please try again later"},
	{"ChangePassword", http.MethodPut, "/api/v1/users/me/password", true, 5, 15 * time.Minute,
		"Too many password change attempts", "Too many password change attempts from this IP, please try again after 15 minutes"},
	{"DeleteCurrentUser", http.MethodDelete, "/api/v1/users/me", true, 5, 15 * time.Minute,
		"Too many deletion attempts", "Too many account deletion attempts from this IP, please try again after 15 minutes"},
}

func (op limitedOperation) hit(t *testing.T, a *app, edits ...func(*http.Request)) *httptest.ResponseRecorder {
	t.Helper()
	if op.authenticated {
		edits = append([]func(*http.Request){bearer(accessTokenFor(t, uuid.New()))}, edits...)
	}
	return a.do(op.method, op.target, "{}", edits...)
}

// exhaust spends op's whole allowance, and fails if any of it was refused.
func (op limitedOperation) exhaust(t *testing.T, a *app, edits ...func(*http.Request)) {
	t.Helper()
	for i := range op.max {
		if w := op.hit(t, a, edits...); w.Code == http.StatusTooManyRequests {
			t.Fatalf("%s: request %d of %d refused", op.operationID, i+1, op.max)
		}
	}
}

func TestEachLimitedOperationRefusesTheRequestAfterItsLimit(t *testing.T) {
	for _, op := range limitedOperations {
		t.Run(op.operationID, func(t *testing.T) {
			a, _ := limitedApp(t)
			op.exhaust(t, a)

			w := op.hit(t, a)

			if w.Code != http.StatusTooManyRequests {
				t.Fatalf("request %d: status %d, want 429", op.max+1, w.Code)
			}
			got := decode[api.DetailedError](t, w)
			want := api.DetailedError{Error: op.error, Message: op.message, StatusCode: http.StatusTooManyRequests}
			if got != want {
				t.Errorf("body = %+v, want %+v", got, want)
			}
			if retry := w.Header().Get("Retry-After"); retry != strconv.Itoa(int(op.window.Seconds())) {
				t.Errorf("Retry-After = %q, want the whole window, %v", retry, op.window)
			}
		})
	}
}

func TestTheLimitedOperationsAreTheOnesTheSpecDocuments429For(t *testing.T) {
	spec, err := api.GetSwagger()
	if err != nil {
		t.Fatal(err)
	}
	documented := operationsDocumenting429(spec)
	if got := slices.Sorted(maps.Keys(rateLimits)); !slices.Equal(got, documented) {
		t.Errorf("rate limits on %v; the spec documents 429 on %v", got, documented)
	}
	var tested []string
	for _, op := range limitedOperations {
		tested = append(tested, op.operationID)
	}
	if slices.Sort(tested); !slices.Equal(tested, documented) {
		t.Errorf("this file tests %v; the spec documents 429 on %v", tested, documented)
	}
}

func TestLimitsMustMatchTheSpec(t *testing.T) {
	spec, err := api.GetSwagger()
	if err != nil {
		t.Fatal(err)
	}
	missing := maps.Clone(rateLimits)
	delete(missing, "Login")
	if err := checkRateLimits(spec, missing); err == nil {
		t.Error("an operation documenting 429 with no limit passed the check")
	}
	extra := maps.Clone(rateLimits)
	extra["ListHabits"] = rateLimits["Login"]
	if err := checkRateLimits(spec, extra); err == nil {
		t.Error("a limit on an operation that does not document 429 passed the check")
	}
	if err := checkRateLimits(spec, rateLimits); err != nil {
		t.Error(err)
	}
}

func TestRateLimitHeadersCountDown(t *testing.T) {
	a, c := limitedApp(t)
	login := limitedOperations[1]

	w := login.hit(t, a)
	c.advance(5 * time.Minute)
	w = login.hit(t, a)

	for name, want := range map[string]string{
		"RateLimit-Policy":    "15;w=900",
		"RateLimit-Limit":     "15",
		"RateLimit-Remaining": "13",
		"RateLimit-Reset":     "600",
	} {
		if got := w.Header().Get(name); got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}
	if got := w.Header().Get("Retry-After"); got != "" {
		t.Errorf("Retry-After = %q on an allowed request", got)
	}
}

func TestTheWindowStartsAtTheFirstRequestAndResets(t *testing.T) {
	a, c := limitedApp(t)
	login := limitedOperations[1]
	login.exhaust(t, a)

	c.advance(login.window - time.Second)
	if w := login.hit(t, a); w.Code != http.StatusTooManyRequests {
		t.Fatalf("a second before the window ends: status %d, want 429", w.Code)
	}
	if got := login.hit(t, a).Header().Get("Retry-After"); got != "1" {
		t.Errorf("Retry-After = %q a second before the end, want 1", got)
	}

	c.advance(time.Second)
	login.exhaust(t, a)
}

func TestALimitIsPerClient(t *testing.T) {
	a, _ := limitedApp(t)
	login := limitedOperations[1]
	login.exhaust(t, a, fromAddress("198.51.100.1:5000"))

	if w := login.hit(t, a, fromAddress("198.51.100.2:5000")); w.Code == http.StatusTooManyRequests {
		t.Error("another address was refused")
	}
	// The port is the connection's, not the client's.
	if w := login.hit(t, a, fromAddress("198.51.100.1:6000")); w.Code != http.StatusTooManyRequests {
		t.Errorf("the same address from another port: status %d, want 429", w.Code)
	}
}

func TestALimitIsPerOperation(t *testing.T) {
	a, _ := limitedApp(t)
	limitedOperations[1].exhaust(t, a)

	limitedOperations[0].exhaust(t, a)
}

func TestAnAnonymousRequestToAProtectedOperationIsNotCounted(t *testing.T) {
	// Authentication answers it first, as jwtAuth does on the Node backend.
	a, _ := limitedApp(t)
	deleteMe := limitedOperations[4]
	for range deleteMe.max * 2 {
		if w := a.do(deleteMe.method, deleteMe.target, "{}"); w.Code != http.StatusUnauthorized {
			t.Fatalf("anonymous delete: status %d, want 401", w.Code)
		}
	}

	deleteMe.exhaust(t, a)
}

func TestOtherOperationsAreNotLimited(t *testing.T) {
	a, _ := limitedApp(t)
	for range 100 {
		if w := a.do(http.MethodPost, "/api/v1/auth/logout", ""); w.Code == http.StatusTooManyRequests {
			t.Fatal("logout was rate limited")
		}
	}
}

func TestAForgedForwardedForDoesNotEscapeTheLimit(t *testing.T) {
	// Behind one proxy, only the address it appended is believed; whatever
	// the caller wrote in front of it is not.
	a, _ := limitedApp(t, func(cfg *Config) { cfg.TrustedProxyHops = 1 })
	login := limitedOperations[1]
	forged := func(i int) func(*http.Request) {
		return withHeader("X-Forwarded-For", "10.0.0."+strconv.Itoa(i)+", 203.0.113.9")
	}
	for i := range login.max {
		login.hit(t, a, forged(i))
	}

	if w := login.hit(t, a, forged(99)); w.Code != http.StatusTooManyRequests {
		t.Fatalf("status %d, want 429", w.Code)
	}
	if w := login.hit(t, a, withHeader("X-Forwarded-For", "203.0.113.10")); w.Code == http.StatusTooManyRequests {
		t.Error("another client behind the same proxy was refused")
	}
}

func TestDisableRateLimitingTurnsEveryLimitOff(t *testing.T) {
	a, _ := limitedApp(t, func(cfg *Config) { cfg.DisableRateLimiting = true })
	for _, op := range limitedOperations {
		for range op.max * 2 {
			if w := op.hit(t, a); w.Code == http.StatusTooManyRequests {
				t.Fatalf("%s was rate limited", op.operationID)
			}
		}
	}
}

func TestExpiredCountsAreForgotten(t *testing.T) {
	cfg := testConfig()
	cfg.DisableRateLimiting = false
	s := newServer(fakeDB{}, newFakeStore(), cfg)
	c := &clock{t: time.Date(2026, 11, 7, 12, 0, 0, 0, time.UTC)}
	s.limiter.now = c.now
	for i := range 50 {
		s.limiter.hit("Login", "198.51.100."+strconv.Itoa(i), rateLimits["Login"])
	}

	c.advance(time.Hour)
	s.limiter.hit("Login", "198.51.100.200", rateLimits["Login"])

	if got := len(s.limiter.counts); got != 1 {
		t.Errorf("%d counts kept, want only the live one", got)
	}
}

func TestClientKey(t *testing.T) {
	for _, tc := range []struct {
		name       string
		hops       int
		remote     string
		forwarded  []string
		wantClient string
	}{
		{"no proxy: the connection's address", 0, "198.51.100.7:443", []string{"203.0.113.1"}, "198.51.100.7"},
		{"one proxy: the entry it appended", 1, "10.0.0.2:443", []string{"6.6.6.6, 203.0.113.1"}, "203.0.113.1"},
		{"two proxies: the second from the end", 2, "10.0.0.2:443", []string{"6.6.6.6, 203.0.113.1, 10.0.0.3"}, "203.0.113.1"},
		{"entries across header lines", 2, "10.0.0.2:443", []string{"6.6.6.6, 203.0.113.1", "10.0.0.3"}, "203.0.113.1"},
		{"a chain shorter than the hops: its first entry", 3, "10.0.0.2:443", []string{"203.0.113.1"}, "203.0.113.1"},
		{"a proxy but no header: the connection's address", 1, "198.51.100.7:443", nil, "198.51.100.7"},
		{"no port", 0, "198.51.100.7", nil, "198.51.100.7"},
		{"an IPv4-mapped IPv6 address is IPv4", 0, "[::ffff:198.51.100.7]:443", nil, "198.51.100.7"},
		{"IPv6 is grouped by /56", 0, "[2001:db8:1:2ff:aaaa::1]:443", nil, "2001:db8:1:200::/56"},
		{"a forwarded IPv6 address too", 1, "10.0.0.2:443", []string{"2001:db8:1:2ff::9"}, "2001:db8:1:200::/56"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
			r.RemoteAddr = tc.remote
			for _, value := range tc.forwarded {
				r.Header.Add("X-Forwarded-For", value)
			}
			if got := clientKey(r, tc.hops); got != tc.wantClient {
				t.Errorf("clientKey = %q, want %q", got, tc.wantClient)
			}
		})
	}
}

func TestNewRefusesANegativeHopCount(t *testing.T) {
	cfg := testConfig()
	cfg.TrustedProxyHops = -1
	cfg.DB = &pgxpool.Pool{}
	if _, err := New(cfg); err == nil {
		t.Fatal("New with TrustedProxyHops -1 succeeded")
	}
}
