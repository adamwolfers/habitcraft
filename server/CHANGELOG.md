# Changelog

Changes to the Go module `github.com/adamwolfers/habitcraft/server` that an
embedding application can see: the exported API of packages `habitcraft` and
`schema`, and the behaviour behind it. The HTTP API has its own contract,
`shared/api-spec/openapi.yaml`, and its own breaking-change gate.

Versions are tagged `server/vX.Y.Z`, as Go requires for a module in a
subdirectory. Before v1.0.0 a minor version may break the API. Every break is
listed under **Breaking**, and `scripts/go-api-check.sh` (run by CI's
`server-unit-tests` job) fails on an incompatible change that the Unreleased
section does not list that way.

## Unreleased

## v0.1.0

The first version an application can embed (habitcraft-vxln.6).

- `habitcraft.New(Config)` and `Server.Handler()` serve the whole HTTP API.
- `habitcraft.Migrate` applies the embedded migrations, compatibly with
  dbmate's `schema_migrations` table. `schema.Migrations` holds the files, for
  a host that runs its own migration tool.
- `Config.OnCompletion` receives a `CompletionEvent` for each day checked off,
  unchecked, or whose note changed: after the commit, at most once.
- The generated HTTP types moved to `internal/api` and the operations are no
  longer methods of `Server`; neither was meant to be imported.
