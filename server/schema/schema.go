// Package schema is HabitCraft's database schema: the migrations that build
// it, and schema.sql beside them, a pg_dump of their result that
// scripts/schema-dump.sh generates and CI diffs.
//
// The migrations are in dbmate's format, so an application that already runs
// a migration tool can feed it these files. habitcraft.Migrate applies them
// itself, recording each in the same schema_migrations table dbmate uses, so
// either can take over from the other on the same database.
package schema

import (
	"embed"
	"io/fs"
)

//go:embed migrations/*.sql
var files embed.FS

// Migrations holds the migration files at its root, each named
// <version>_<description>.sql, with an up section after a "-- migrate:up"
// line and a down section, unused (migrations are forward-only), after
// "-- migrate:down".
var Migrations fs.FS = mustSub(files, "migrations")

func mustSub(fsys fs.FS, dir string) fs.FS {
	sub, err := fs.Sub(fsys, dir)
	if err != nil {
		panic(err) // dir is a constant that go:embed has already checked
	}
	return sub
}
