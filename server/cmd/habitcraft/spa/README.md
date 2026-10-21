# The embedded web app

`npm run build` in [`web/`](../../../../web/README.md) writes the web app into
`dist/` here, and `go build` embeds it in the binary (`../webapp.go`).
`dist/` is gitignored. Without it the binary serves the API alone.

This file keeps the directory in git: `go:embed` fails on a directory that
does not exist.
