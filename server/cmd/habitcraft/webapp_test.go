package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

// The bundle as Vite builds it: index.html, and assets named by their hash.
var bundle = fstest.MapFS{
	"index.html":           {Data: []byte("<!doctype html><title>HabitCraft</title>")},
	"assets/index-abc1.js": {Data: []byte("console.log('app')")},
	"favicon.svg":          {Data: []byte("<svg/>")},
}

// fakeAPI answers every request it gets, so a test can tell where one went.
var fakeAPI = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusTeapot)
	_, _ = io.WriteString(w, `{"from":"api"}`)
})

var specPaths = []string{"/health", "/hello", "/api/v1/habits", "/api/v1/habits/{habitId}"}

func serve(t *testing.T, handler http.Handler, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))
	return recorder
}

func TestWebAppSendsTheSpecsPathsToTheAPI(t *testing.T) {
	handler := withWebApp(fakeAPI, bundle, specPaths)

	for _, path := range []string{
		"/health",
		"/hello",
		"/api/v1/habits",
		"/api/v1/habits/0b6f1d2e-0000-4000-8000-000000000000",
		// Not in the spec, but under /api: the API's 404, never the web app.
		"/api/v2/anything",
		"/api",
	} {
		if got := serve(t, handler, http.MethodGet, path); got.Code != http.StatusTeapot {
			t.Errorf("GET %s: status %d, want the API's %d", path, got.Code, http.StatusTeapot)
		}
	}
	if got := serve(t, handler, http.MethodPost, "/api/v1/habits"); got.Code != http.StatusTeapot {
		t.Errorf("POST /api/v1/habits: status %d, want the API's", got.Code)
	}
}

func TestWebAppServesTheBundlesFiles(t *testing.T) {
	handler := withWebApp(fakeAPI, bundle, specPaths)

	got := serve(t, handler, http.MethodGet, "/assets/index-abc1.js")
	if got.Code != http.StatusOK || got.Body.String() != "console.log('app')" {
		t.Fatalf("GET an asset: %d %q", got.Code, got.Body.String())
	}
	// A hashed asset's name changes with its content, so it can be kept forever.
	if cache := got.Header().Get("Cache-Control"); cache != "public, max-age=31536000, immutable" {
		t.Errorf("an asset's Cache-Control is %q", cache)
	}
	if contentType := got.Header().Get("Content-Type"); contentType != "text/javascript; charset=utf-8" {
		t.Errorf("an asset's Content-Type is %q", contentType)
	}

	got = serve(t, handler, http.MethodGet, "/favicon.svg")
	if got.Code != http.StatusOK || got.Body.String() != "<svg/>" {
		t.Fatalf("GET a file outside assets/: %d %q", got.Code, got.Body.String())
	}
	if cache := got.Header().Get("Cache-Control"); cache != "no-cache" {
		t.Errorf("an unhashed file's Cache-Control is %q, want no-cache", cache)
	}
}

func TestWebAppAnswersEveryOtherPathWithIndexHTML(t *testing.T) {
	handler := withWebApp(fakeAPI, bundle, specPaths)

	// The app's own routes, a directory, a missing file and the index itself:
	// the browser loads the app, and the app decides what to show.
	for _, path := range []string{"/", "/login", "/habits/123", "/assets", "/assets/", "/missing.js", "/index.html", "/healthy"} {
		got := serve(t, handler, http.MethodGet, path)
		if got.Code != http.StatusOK || got.Body.String() != "<!doctype html><title>HabitCraft</title>" {
			t.Errorf("GET %s: %d %q, want index.html", path, got.Code, got.Body.String())
			continue
		}
		// A new release must reach the browser on its next load.
		if cache := got.Header().Get("Cache-Control"); cache != "no-cache" {
			t.Errorf("GET %s: Cache-Control is %q, want no-cache", path, cache)
		}
		if contentType := got.Header().Get("Content-Type"); contentType != "text/html; charset=utf-8" {
			t.Errorf("GET %s: Content-Type is %q", path, contentType)
		}
	}
}

func TestWebAppAnswersHEADAndRefusesOtherMethods(t *testing.T) {
	handler := withWebApp(fakeAPI, bundle, specPaths)

	if got := serve(t, handler, http.MethodHead, "/login"); got.Code != http.StatusOK {
		t.Errorf("HEAD /login: status %d", got.Code)
	}
	got := serve(t, handler, http.MethodPost, "/login")
	if got.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST /login: status %d, want %d", got.Code, http.StatusMethodNotAllowed)
	}
	if allow := got.Header().Get("Allow"); allow != "GET, HEAD" {
		t.Errorf("POST /login: Allow is %q", allow)
	}
}

func TestWithoutABundleOnlyTheAPIIsServed(t *testing.T) {
	// What `go build` embeds when web/ was never built: no index.html. The
	// API then answers every path, with its own 404 for the app's.
	handler := withWebApp(fakeAPI, fstest.MapFS{}, specPaths)

	for _, path := range []string{"/health", "/", "/login"} {
		if got := serve(t, handler, http.MethodGet, path); got.Code != http.StatusTeapot {
			t.Errorf("GET %s: status %d, want the API's", path, got.Code)
		}
	}
}

func TestTheEmbeddedBundleIsFoundWhereViteBuildsIt(t *testing.T) {
	files, err := webAppFiles()
	if err != nil {
		t.Fatal(err)
	}
	// Whether or not web/ was built, the bundle's root is the dist directory.
	if _, err := files.Open("README.md"); err == nil {
		t.Error("the bundle's root holds spa/README.md; want spa/dist")
	}
}
