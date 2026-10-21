package main

import (
	"bytes"
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
	"time"
)

// spa holds the web app (web/), which `npm run build` there writes into
// spa/dist. The README keeps the directory in git, so the binary builds, and
// serves the API alone, before the web app has ever been built.
//
//go:embed all:spa
var spa embed.FS

// webAppFiles returns the embedded bundle, rooted where index.html is.
func webAppFiles() (fs.FS, error) {
	return fs.Sub(spa, "spa/dist")
}

// withWebApp serves the web app beside api. A path under one of the spec's
// top-level segments (/api, /health, /hello) goes to api, matched or not, so
// an unknown API route gets the API's 404 and never the app. Any other GET
// gets the bundle's file at that path or, when there is none, index.html, so
// the app's own routes survive a reload.
//
// Without index.html in files the web app is off and every path goes to api.
func withWebApp(api http.Handler, files fs.FS, specPaths []string) http.Handler {
	index, err := fs.ReadFile(files, "index.html")
	if err != nil {
		return api
	}
	ownedByAPI := topSegments(specPaths)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ownedByAPI[strings.SplitN(strings.TrimPrefix(r.URL.Path, "/"), "/", 2)[0]] {
			api.ServeHTTP(w, r)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}

		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if data, err := fs.ReadFile(files, name); err == nil && name != "" {
			// Vite names everything under assets/ by its content's hash.
			if strings.HasPrefix(name, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache")
			}
			http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(data))
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(index))
	})
}

// topSegments returns the first segment of each path: "api" for
// "/api/v1/habits".
func topSegments(paths []string) map[string]bool {
	segments := make(map[string]bool, len(paths))
	for _, p := range paths {
		segments[strings.SplitN(strings.TrimPrefix(p, "/"), "/", 2)[0]] = true
	}
	return segments
}
