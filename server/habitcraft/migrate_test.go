package habitcraft

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adamwolfers/habitcraft/server/schema"
)

func TestParseMigration(t *testing.T) {
	t.Run("the up section runs from its marker to the down marker", func(t *testing.T) {
		m, err := parseMigration("20260101000000_add_things.sql",
			"-- migrate:up\nCREATE TABLE things (id int);\n\n-- migrate:down\nDROP TABLE things;\n")
		if err != nil {
			t.Fatal(err)
		}
		if m.version != "20260101000000" {
			t.Errorf("version %q", m.version)
		}
		if strings.TrimSpace(m.up) != "CREATE TABLE things (id int);" {
			t.Errorf("up %q", m.up)
		}
		if !m.transaction {
			t.Error("a migration runs in a transaction unless it says otherwise")
		}
	})

	t.Run("without a down section the up section runs to the end", func(t *testing.T) {
		m, err := parseMigration("1_x.sql", "-- migrate:up\nSELECT 1;\n")
		if err != nil {
			t.Fatal(err)
		}
		if strings.TrimSpace(m.up) != "SELECT 1;" {
			t.Errorf("up %q", m.up)
		}
	})

	t.Run("transaction:false runs it outside a transaction, as dbmate does", func(t *testing.T) {
		m, err := parseMigration("1_x.sql", "-- migrate:up transaction:false\nCREATE INDEX CONCURRENTLY i ON t (c);\n")
		if err != nil {
			t.Fatal(err)
		}
		if m.transaction {
			t.Error("transaction:false ignored")
		}
	})

	for name, content := range map[string]string{
		"no up section":           "CREATE TABLE things (id int);\n",
		"down before up":          "-- migrate:down\nSELECT 1;\n-- migrate:up\nSELECT 2;\n",
		"two up sections":         "-- migrate:up\nSELECT 1;\n-- migrate:up\nSELECT 2;\n",
		"an option it cannot use": "-- migrate:up transaction:maybe\nSELECT 1;\n",
	} {
		t.Run("refuses "+name, func(t *testing.T) {
			if _, err := parseMigration("1_x.sql", content); err == nil {
				t.Error("parsed")
			}
		})
	}
}

func TestParseMigrations(t *testing.T) {
	t.Run("sorts by version and skips files that are not migrations", func(t *testing.T) {
		got, err := parseMigrations(fstest.MapFS{
			"20260201000000_second.sql": {Data: []byte("-- migrate:up\nSELECT 2;\n")},
			"20260101000000_first.sql":  {Data: []byte("-- migrate:up\nSELECT 1;\n")},
			"README.md":                 {Data: []byte("not sql")},
			"notes.sql":                 {Data: []byte("no version")},
		})
		if err != nil {
			t.Fatal(err)
		}
		if versions := versionsOf(got); !slices.Equal(versions, []string{"20260101000000", "20260201000000"}) {
			t.Errorf("versions %v", versions)
		}
	})

	t.Run("refuses two files with one version", func(t *testing.T) {
		_, err := parseMigrations(fstest.MapFS{
			"1_a.sql": {Data: []byte("-- migrate:up\nSELECT 1;\n")},
			"1_b.sql": {Data: []byte("-- migrate:up\nSELECT 1;\n")},
		})
		if err == nil {
			t.Error("parsed")
		}
	})

	t.Run("every embedded migration parses", func(t *testing.T) {
		got, err := parseMigrations(schema.Migrations)
		if err != nil {
			t.Fatal(err)
		}
		files, _ := fs.Glob(schema.Migrations, "*.sql")
		if len(got) == 0 || len(got) != len(files) {
			t.Errorf("parsed %d of %d files", len(got), len(files))
		}
	})
}

func versionsOf(ms []migration) []string {
	out := make([]string, 0, len(ms))
	for _, m := range ms {
		out = append(out, m.version)
	}
	return out
}

// The tests below need HABITCRAFT_TEST_DATABASE_URL, as the store tests do.
// Each runs in a Postgres schema of its own, first on the search path, so it
// starts empty and leaves the database as it found it.

func TestMigrateOnPostgres(t *testing.T) {
	t.Run("brings an empty schema to every embedded migration", func(t *testing.T) {
		pool := emptySchema(t)
		applied, err := Migrate(t.Context(), pool)
		if err != nil {
			t.Fatal(err)
		}
		want, _ := parseMigrations(schema.Migrations)
		if !slices.Equal(applied, versionsOf(want)) {
			t.Errorf("applied %v, want %v", applied, versionsOf(want))
		}
		if got := recordedVersions(t, pool); !slices.Equal(got, versionsOf(want)) {
			t.Errorf("schema_migrations holds %v", got)
		}
		// The server's own queries work on the result.
		u, _ := createTestUser(t, pgStore{pool: pool})
		if _, err := (pgStore{pool: pool}).userByID(t.Context(), u.id); err != nil {
			t.Errorf("reading back a user: %v", err)
		}
	})

	t.Run("applies nothing a second time", func(t *testing.T) {
		pool := emptySchema(t)
		if _, err := Migrate(t.Context(), pool); err != nil {
			t.Fatal(err)
		}
		applied, err := Migrate(t.Context(), pool)
		if err != nil || len(applied) != 0 {
			t.Errorf("second run applied %v, %v", applied, err)
		}
	})

	t.Run("applies only the migrations not yet recorded", func(t *testing.T) {
		pool := emptySchema(t)
		first := fstest.MapFS{"1_a.sql": {Data: []byte("-- migrate:up\nCREATE TABLE a (id int);\n")}}
		if _, err := migrate(t.Context(), pool, first); err != nil {
			t.Fatal(err)
		}
		both := fstest.MapFS{
			"1_a.sql": first["1_a.sql"],
			"2_b.sql": {Data: []byte("-- migrate:up\nCREATE TABLE b (id int);\n")},
		}
		applied, err := migrate(t.Context(), pool, both)
		if err != nil || !slices.Equal(applied, []string{"2"}) {
			t.Errorf("applied %v, %v", applied, err)
		}
	})

	t.Run("a failing migration leaves nothing of itself and stops the run", func(t *testing.T) {
		pool := emptySchema(t)
		_, err := migrate(t.Context(), pool, fstest.MapFS{
			"1_a.sql": {Data: []byte("-- migrate:up\nCREATE TABLE a (id int);\n")},
			"2_b.sql": {Data: []byte("-- migrate:up\nCREATE TABLE b (id int);\nSELECT no_such_function();\n")},
			"3_c.sql": {Data: []byte("-- migrate:up\nCREATE TABLE c (id int);\n")},
		})
		if err == nil || !strings.Contains(err.Error(), "2_b.sql") {
			t.Fatalf("error %v, want one naming 2_b.sql", err)
		}
		if got := recordedVersions(t, pool); !slices.Equal(got, []string{"1"}) {
			t.Errorf("recorded %v, want [1]", got)
		}
		for _, table := range []string{"b", "c"} {
			if tableExists(t, pool, table) {
				t.Errorf("table %s exists", table)
			}
		}
	})

	t.Run("runs a transaction:false migration outside a transaction", func(t *testing.T) {
		pool := emptySchema(t)
		_, err := migrate(t.Context(), pool, fstest.MapFS{
			"1_a.sql": {Data: []byte("-- migrate:up\nCREATE TABLE a (id int);\n")},
			// CONCURRENTLY is refused inside a transaction block.
			"2_b.sql": {Data: []byte("-- migrate:up transaction:false\nCREATE INDEX CONCURRENTLY a_id ON a (id);\n")},
		})
		if err != nil {
			t.Fatal(err)
		}
	})

	t.Run("concurrent runs apply each migration once", func(t *testing.T) {
		pool := emptySchema(t)
		var wg sync.WaitGroup
		errs := make([]error, 4)
		applied := make([][]string, len(errs))
		for i := range errs {
			wg.Go(func() { applied[i], errs[i] = Migrate(t.Context(), pool) })
		}
		wg.Wait()
		total := 0
		for i, err := range errs {
			if err != nil {
				t.Errorf("run %d: %v", i, err)
			}
			total += len(applied[i])
		}
		want, _ := parseMigrations(schema.Migrations)
		if total != len(want) {
			t.Errorf("applied %d migrations across the runs, want %d", total, len(want))
		}
	})
}

// emptySchema returns a pool whose search path starts with a new, empty
// schema, dropped when the test ends. public follows it, for the uuid-ossp
// functions the baseline migration's extension puts there.
func emptySchema(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("HABITCRAFT_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("HABITCRAFT_TEST_DATABASE_URL is not set")
	}
	name := "migrate_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	admin, err := pgxpool.New(t.Context(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	if _, err := admin.Exec(t.Context(), "CREATE SCHEMA "+name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+name+" CASCADE")
	})

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

func recordedVersions(t *testing.T, pool *pgxpool.Pool) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), "SELECT version FROM schema_migrations ORDER BY version")
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			t.Fatal(err)
		}
		out = append(out, v)
	}
	return out
}

func tableExists(t *testing.T, pool *pgxpool.Pool, table string) bool {
	t.Helper()
	var exists bool
	err := pool.QueryRow(t.Context(),
		"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1)",
		table).Scan(&exists)
	if err != nil {
		t.Fatal(err)
	}
	return exists
}
