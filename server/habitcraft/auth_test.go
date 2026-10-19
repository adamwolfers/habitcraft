package habitcraft

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/adamwolfers/habitcraft/server/api"
)

func TestMain(m *testing.M) {
	// bcrypt at the production cost makes every register and login take
	// tens of milliseconds, more under -race.
	passwordCost = bcrypt.MinCost
	os.Exit(m.Run())
}

const (
	alicePassword = "Correct-Horse-1"
	newPassword   = "Battery-Staple-2"
)

// An app is the handler under test with its fake store, so a test can make
// requests and also look at what was stored.
type app struct {
	t       *testing.T
	handler http.Handler
	store   *fakeStore
}

func newApp(t *testing.T, edits ...func(*Config)) *app {
	t.Helper()
	cfg := testConfig()
	for _, edit := range edits {
		edit(&cfg)
	}
	st := newFakeStore()
	handler, err := newServer(fakeDB{}, st, cfg).Handler()
	if err != nil {
		t.Fatal(err)
	}
	return &app{t: t, handler: handler, store: st}
}

func (a *app) do(method, target, body string, edits ...func(*http.Request)) *httptest.ResponseRecorder {
	a.t.Helper()
	r := httptest.NewRequest(method, target, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	for _, edit := range edits {
		edit(r)
	}
	w := httptest.NewRecorder()
	a.handler.ServeHTTP(w, r)
	return w
}

// register signs up a user and returns the response body: the user and a
// token pair, as the mobile client reads them.
func (a *app) register(email string) api.AuthResponse {
	a.t.Helper()
	w := a.do(http.MethodPost, "/api/v1/auth/register",
		`{"email":"`+email+`","password":"`+alicePassword+`","name":"Alice"}`)
	if w.Code != http.StatusCreated {
		a.t.Fatalf("register: %d %s", w.Code, w.Body)
	}
	return decode[api.AuthResponse](a.t, w)
}

func (a *app) login(email, password string) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.do(http.MethodPost, "/api/v1/auth/login", `{"email":"`+email+`","password":"`+password+`"}`)
}

func (a *app) refresh(refresh string) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.do(http.MethodPost, "/api/v1/auth/refresh", `{"refreshToken":"`+refresh+`"}`)
}

func (a *app) me(edits ...func(*http.Request)) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.do(http.MethodGet, "/api/v1/users/me", "", edits...)
}

func (a *app) changePassword(access, current, next, confirm string) *httptest.ResponseRecorder {
	a.t.Helper()
	body, _ := json.Marshal(map[string]string{
		"currentPassword": current, "newPassword": next, "confirmPassword": confirm,
	})
	return a.do(http.MethodPut, "/api/v1/users/me/password", string(body), bearer(access))
}

func bearer(token string) func(*http.Request) {
	return func(r *http.Request) { r.Header.Set("Authorization", "Bearer "+token) }
}

func withCookie(name, value string) func(*http.Request) {
	return func(r *http.Request) { r.AddCookie(&http.Cookie{Name: name, Value: value}) }
}

func withHeader(name, value string) func(*http.Request) {
	return func(r *http.Request) { r.Header.Set(name, value) }
}

// accessTokenFor is a valid access token for any user, stored or not.
func accessTokenFor(t *testing.T, userID uuid.UUID) string {
	t.Helper()
	pair, err := testTokens(time.Now()).issue(userID)
	if err != nil {
		t.Fatal(err)
	}
	return pair.access
}

func errorOf(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	return decode[api.Error](t, w).Error
}

// cookiesSet parses the response's Set-Cookie headers by name.
func cookiesSet(w *httptest.ResponseRecorder) map[string]*http.Cookie {
	cookies := map[string]*http.Cookie{}
	for _, c := range w.Result().Cookies() {
		cookies[c.Name] = c
	}
	return cookies
}

func assertSessionCookies(t *testing.T, w *httptest.ResponseRecorder, access, refresh string) {
	t.Helper()
	cookies := cookiesSet(w)
	for name, want := range map[string]struct {
		value  string
		maxAge time.Duration
	}{accessCookie: {access, accessTokenTTL}, refreshCookie: {refresh, refreshTokenTTL}} {
		c := cookies[name]
		if c == nil {
			t.Errorf("no %s cookie set", name)
			continue
		}
		if c.Value != want.value || !c.HttpOnly || c.Path != "/" || c.MaxAge != int(want.maxAge.Seconds()) {
			t.Errorf("%s cookie = %+v", name, c)
		}
		if !c.Secure || c.SameSite != http.SameSiteStrictMode {
			t.Errorf("%s cookie is not Secure and SameSite=Strict: %+v", name, c)
		}
	}
}

// --- authentication -------------------------------------------------------

func TestAProtectedOperationNeedsAToken(t *testing.T) {
	w := newApp(t).me()

	if w.Code != http.StatusUnauthorized || errorOf(t, w) != "No token provided" {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

// Authentication runs before validation, so an anonymous caller never sees
// which fields were wrong (the vxln.4 decision; Node behaves the same).
func TestAnAnonymousInvalidRequestIs401Not400(t *testing.T) {
	w := newApp(t).do(http.MethodPut, "/api/v1/users/me/password", `{}`)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got %d %s, want 401", w.Code, w.Body)
	}
}

func TestOperationsTheSpecLeavesOpenNeedNoToken(t *testing.T) {
	a := newApp(t)

	if w := a.do(http.MethodGet, "/health", ""); w.Code != http.StatusOK {
		t.Errorf("health: %d", w.Code)
	}
	if w := a.do(http.MethodPost, "/api/v1/auth/logout", ""); w.Code != http.StatusOK {
		t.Errorf("logout: %d", w.Code)
	}
}

func TestBadAccessTokensAre401(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")
	expired, _ := tokens{secret: testSecret, now: func() time.Time { return time.Now().Add(-time.Hour) }}.issue(session.User.Id)
	otherSecret, _ := tokens{secret: []byte("another-secret-that-is-32-bytes-long"), now: time.Now}.issue(session.User.Id)

	cases := []struct {
		name, authorization, want string
	}{
		{"not Bearer", "Token " + session.AccessToken, "Invalid token format"},
		{"scheme only", "Bearer", "Invalid token format"},
		{"extra part", "Bearer " + session.AccessToken + " more", "Invalid token format"},
		{"malformed", "Bearer not-a-jwt", "Invalid token"},
		{"wrong secret", "Bearer " + otherSecret.access, "Invalid token"},
		{"expired", "Bearer " + expired.access, "Token expired"},
		{"refresh token", "Bearer " + session.RefreshToken, "Invalid token type"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := a.me(withHeader("Authorization", c.authorization))

			if w.Code != http.StatusUnauthorized || errorOf(t, w) != c.want {
				t.Errorf("got %d %s, want 401 %q", w.Code, w.Body, c.want)
			}
		})
	}
}

func TestTheCookieWinsOverTheHeader(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")

	if w := a.me(withCookie(accessCookie, session.AccessToken), withHeader("Authorization", "garbage")); w.Code != http.StatusOK {
		t.Errorf("good cookie, bad header: %d %s", w.Code, w.Body)
	}
	if w := a.me(withCookie(accessCookie, "garbage"), bearer(session.AccessToken)); w.Code != http.StatusUnauthorized {
		t.Errorf("bad cookie, good header: %d %s", w.Code, w.Body)
	}
}

// --- register -------------------------------------------------------------

func TestRegisterStartsASession(t *testing.T) {
	a := newApp(t)
	w := a.do(http.MethodPost, "/api/v1/auth/register",
		`{"email":"Alice@Example.COM","password":"`+alicePassword+`","name":"  Alice  "}`)

	if w.Code != http.StatusCreated {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	got := decode[api.AuthResponse](t, w)
	if got.User.Email != "alice@example.com" || got.User.Name != "Alice" || got.User.CreatedAt.IsZero() {
		t.Errorf("user = %+v", got.User)
	}
	assertSessionCookies(t, w, got.AccessToken, got.RefreshToken)
	if me := a.me(bearer(got.AccessToken)); me.Code != http.StatusOK {
		t.Errorf("the new access token does not work: %d", me.Code)
	}
	if a.store.liveSessions(got.User.Id) != 1 {
		t.Error("the refresh token was not stored")
	}
}

func TestRegisterStoresAHashNotThePassword(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")

	u, _ := a.store.userByID(t.Context(), session.User.Id)
	if u.passwordHash == alicePassword || bcrypt.CompareHashAndPassword([]byte(u.passwordHash), []byte(alicePassword)) != nil {
		t.Errorf("stored %q", u.passwordHash)
	}
}

func TestAnEmailRegistersOnceWhateverItsCase(t *testing.T) {
	a := newApp(t)
	a.register("alice@example.com")

	w := a.do(http.MethodPost, "/api/v1/auth/register",
		`{"email":"ALICE@example.com","password":"`+alicePassword+`","name":"Alice"}`)

	if w.Code != http.StatusConflict || errorOf(t, w) != "User with this email already exists" {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

func TestANameOfOnlySpacesIsRefused(t *testing.T) {
	w := newApp(t).do(http.MethodPost, "/api/v1/auth/register",
		`{"email":"alice@example.com","password":"`+alicePassword+`","name":"   "}`)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	errs := decode[api.ValidationErrors](t, w).Errors
	if len(errs) != 1 || errs[0].Path == nil || *errs[0].Path != "name" {
		t.Errorf("errors = %+v", errs)
	}
}

func TestInsecureCookiesAreForPlainHTTP(t *testing.T) {
	a := newApp(t, func(c *Config) { c.InsecureCookies = true })
	w := a.do(http.MethodPost, "/api/v1/auth/register",
		`{"email":"alice@example.com","password":"`+alicePassword+`","name":"Alice"}`)

	for name, c := range cookiesSet(w) {
		if c.Secure || c.SameSite != http.SameSiteLaxMode || !c.HttpOnly {
			t.Errorf("%s cookie = %+v", name, c)
		}
	}
}

// --- login ----------------------------------------------------------------

func TestLoginStartsASession(t *testing.T) {
	a := newApp(t)
	registered := a.register("alice@example.com")

	w := a.login("ALICE@example.com", alicePassword)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	got := decode[api.AuthResponse](t, w)
	if got.User != registered.User {
		t.Errorf("user = %+v, want %+v", got.User, registered.User)
	}
	assertSessionCookies(t, w, got.AccessToken, got.RefreshToken)
	if a.store.liveSessions(got.User.Id) != 2 {
		t.Error("login did not store a second session")
	}
}

// The same message either way, so a caller cannot learn who has an account.
func TestBadCredentialsAreRefusedAlike(t *testing.T) {
	a := newApp(t)
	a.register("alice@example.com")

	for _, w := range []*httptest.ResponseRecorder{
		a.login("alice@example.com", "Wrong-Password-1"),
		a.login("nobody@example.com", alicePassword),
	} {
		if w.Code != http.StatusUnauthorized || errorOf(t, w) != "Invalid credentials" {
			t.Errorf("got %d %s", w.Code, w.Body)
		}
	}
}

// bcrypt reads at most 72 bytes. The spec allows 72 characters, which can be
// more bytes than that, so the server cuts the password at 72 bytes as the
// Node backend's bcrypt does, rather than failing.
func TestAPasswordLongerThan72BytesStillWorks(t *testing.T) {
	a := newApp(t)
	long := strings.Repeat("é", 40) + "A1" // 42 characters, 82 bytes
	w := a.do(http.MethodPost, "/api/v1/auth/register",
		`{"email":"alice@example.com","password":"`+long+`","name":"Alice"}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("register: %d %s", w.Code, w.Body)
	}

	if w := a.login("alice@example.com", long); w.Code != http.StatusOK {
		t.Errorf("login: %d %s", w.Code, w.Body)
	}
}

// --- current user ---------------------------------------------------------

func TestTheCurrentUserIsTheTokensOwner(t *testing.T) {
	a := newApp(t)
	registered := a.register("alice@example.com")
	a.register("bob@example.com")

	w := a.me(bearer(registered.AccessToken))

	if got := decode[api.User](t, w); w.Code != http.StatusOK || got != registered.User {
		t.Errorf("got %d %+v", w.Code, got)
	}
}

func TestAValidTokenForAMissingUserIs404(t *testing.T) {
	w := newApp(t).me(bearer(accessTokenFor(t, uuid.New())))

	if w.Code != http.StatusNotFound || errorOf(t, w) != "User not found" {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

// --- refresh --------------------------------------------------------------

func TestRefreshRotatesThePair(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")

	w := a.refresh(session.RefreshToken)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	renewed := decode[api.TokenPair](t, w)
	if renewed.RefreshToken == session.RefreshToken || renewed.AccessToken == session.AccessToken {
		t.Error("refresh handed back the same tokens")
	}
	assertSessionCookies(t, w, renewed.AccessToken, renewed.RefreshToken)
	if w := a.refresh(renewed.RefreshToken); w.Code != http.StatusOK {
		t.Errorf("the new refresh token does not work: %d", w.Code)
	}
}

func TestARefreshTokenWorksOnce(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")
	a.refresh(session.RefreshToken)

	w := a.refresh(session.RefreshToken)

	if w.Code != http.StatusUnauthorized || errorOf(t, w) != "Token has been revoked" {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

func TestRefreshReadsTheCookieFirst(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")

	w := a.do(http.MethodPost, "/api/v1/auth/refresh", `{"refreshToken":"garbage"}`,
		withCookie(refreshCookie, session.RefreshToken))

	if w.Code != http.StatusOK {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

func TestRefreshWithoutATokenIs400(t *testing.T) {
	a := newApp(t)
	for _, body := range []string{"", `{}`, `{"refreshToken":""}`, `not json`} {
		w := a.do(http.MethodPost, "/api/v1/auth/refresh", body)

		if w.Code != http.StatusBadRequest || errorOf(t, w) != "Refresh token is required" {
			t.Errorf("body %q: got %d %s", body, w.Code, w.Body)
		}
	}
}

func TestBadRefreshTokensAre401(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")
	expired, _ := tokens{secret: testSecret, now: func() time.Time { return time.Now().Add(-8 * 24 * time.Hour) }}.issue(session.User.Id)
	// Signed with the right secret but never stored, as after a database restore.
	unstored, _ := testTokens(time.Now()).issue(session.User.Id)
	// Stored for Alice, but claiming to be Bob's.
	stolen, _ := jwt.NewWithClaims(signingMethod, claims{
		UserID: uuid.NewString(), Type: refreshToken,
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	}).SignedString(testSecret)
	a.store.startSession(t.Context(), session_(session.User.Id, stolen))

	cases := []struct{ name, token, want string }{
		{"malformed", "garbage", "Invalid refresh token"},
		{"expired", expired.refresh, "Refresh token expired"},
		{"access token", session.AccessToken, "Invalid token type"},
		{"never stored", unstored.refresh, "Invalid refresh token"},
		{"another user's", stolen, "Invalid refresh token"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := a.refresh(c.token)

			if w.Code != http.StatusUnauthorized || errorOf(t, w) != c.want {
				t.Errorf("got %d %s, want 401 %q", w.Code, w.Body, c.want)
			}
		})
	}
}

// session_ stores token as a session for userID.
func session_(userID uuid.UUID, token string) session {
	return session{userID: userID, tokenHash: hashToken(token), expiresAt: time.Now().Add(time.Hour)}
}

// --- logout ---------------------------------------------------------------

func TestLogoutEndsTheSessionAndClearsTheCookies(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")

	w := a.do(http.MethodPost, "/api/v1/auth/logout", "", withCookie(refreshCookie, session.RefreshToken))

	if w.Code != http.StatusOK || decode[api.Message](t, w).Message != "Logged out successfully" {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	for _, name := range []string{accessCookie, refreshCookie} {
		if c := cookiesSet(w)[name]; c == nil || c.MaxAge >= 0 || c.Value != "" {
			t.Errorf("%s cookie not cleared: %+v", name, c)
		}
	}
	if w := a.refresh(session.RefreshToken); w.Code != http.StatusUnauthorized {
		t.Errorf("refresh after logout: %d", w.Code)
	}
}

// Logging out is not an error even when there is nothing, or nothing that
// can be, revoked: the client is signed out either way.
func TestLogoutAlwaysSucceeds(t *testing.T) {
	a := newApp(t)
	a.store.err = errors.New("database down")

	if w := a.do(http.MethodPost, "/api/v1/auth/logout", "", withCookie(refreshCookie, "x")); w.Code != http.StatusOK {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

// --- change password ------------------------------------------------------

func TestChangingPasswordNeedsTheCurrentOne(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")

	w := a.changePassword(session.AccessToken, "Wrong-Password-1", newPassword, newPassword)

	if w.Code != http.StatusUnauthorized || errorOf(t, w) != "Invalid current password" {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
	if w := a.login("alice@example.com", alicePassword); w.Code != http.StatusOK {
		t.Error("the password changed anyway")
	}
}

func TestTheNewPasswordMustBeConfirmed(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")

	w := a.changePassword(session.AccessToken, alicePassword, newPassword, "Something-Else-3")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	errs := decode[api.ValidationErrors](t, w).Errors
	if len(errs) != 1 || errs[0].Path == nil || *errs[0].Path != "confirmPassword" {
		t.Errorf("errors = %+v", errs)
	}
}

// Every session is revoked, the caller's included, and the caller carries on
// with a fresh pair (habitcraft-4k7v).
func TestChangingPasswordEndsEverySessionButHandsTheCallerANewOne(t *testing.T) {
	a := newApp(t)
	caller := a.register("alice@example.com")
	other := decode[api.AuthResponse](t, a.login("alice@example.com", alicePassword))

	w := a.changePassword(caller.AccessToken, alicePassword, newPassword, newPassword)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
	changed := decode[api.PasswordChanged](t, w)
	if changed.Message != "Password changed successfully" {
		t.Errorf("message = %q", changed.Message)
	}
	assertSessionCookies(t, w, changed.AccessToken, changed.RefreshToken)

	for name, old := range map[string]string{"caller's": caller.RefreshToken, "other session's": other.RefreshToken} {
		if w := a.refresh(old); w.Code != http.StatusUnauthorized {
			t.Errorf("the %s old refresh token still works: %d", name, w.Code)
		}
	}
	if w := a.refresh(changed.RefreshToken); w.Code != http.StatusOK {
		t.Errorf("the fresh refresh token does not work: %d %s", w.Code, w.Body)
	}
	if w := a.me(bearer(changed.AccessToken)); w.Code != http.StatusOK {
		t.Errorf("the fresh access token does not work: %d", w.Code)
	}
}

func TestOnlyTheNewPasswordSignsInAfterAChange(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")
	a.changePassword(session.AccessToken, alicePassword, newPassword, newPassword)

	if w := a.login("alice@example.com", alicePassword); w.Code != http.StatusUnauthorized {
		t.Errorf("old password: %d", w.Code)
	}
	if w := a.login("alice@example.com", newPassword); w.Code != http.StatusOK {
		t.Errorf("new password: %d", w.Code)
	}
}

func TestChangingTheMissingUsersPasswordIs404(t *testing.T) {
	w := newApp(t).changePassword(accessTokenFor(t, uuid.New()), alicePassword, newPassword, newPassword)

	if w.Code != http.StatusNotFound {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
}

// --- failures -------------------------------------------------------------

func TestAStoreFailureIs500WithoutDetail(t *testing.T) {
	a := newApp(t)
	session := a.register("alice@example.com")
	a.store.err = errors.New("connection refused to 10.0.0.5")

	for name, w := range map[string]*httptest.ResponseRecorder{
		"register": a.do(http.MethodPost, "/api/v1/auth/register", `{"email":"b@example.com","password":"`+alicePassword+`","name":"B"}`),
		"login":    a.login("alice@example.com", alicePassword),
		"refresh":  a.refresh(session.RefreshToken),
		"me":       a.me(bearer(session.AccessToken)),
		"change":   a.changePassword(session.AccessToken, alicePassword, newPassword, newPassword),
	} {
		if w.Code != http.StatusInternalServerError || strings.Contains(w.Body.String(), "10.0.0.5") {
			t.Errorf("%s: got %d %s", name, w.Code, w.Body)
		}
	}
}
