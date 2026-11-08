package habitcraft

import (
	"context"
	"fmt"
	"io/fs"
	"regexp"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adamwolfers/habitcraft/server/schema"
)

// Migrate applies the migrations in schema.Migrations that the database has
// not recorded yet, oldest first, and returns the versions it applied. Run it
// before serving: the server expects the schema of the version it was built
// with.
//
// It does what dbmate's "up" does, in the same schema_migrations table, so
// either can migrate a database the other has. Each migration runs in a
// transaction with the row that records it, unless its up line says
// transaction:false. The first that fails stops the run, and the error names
// its file. Concurrent runs, as from replicas starting together, wait for one
// another on a Postgres advisory lock, so each migration is applied once.
//
// Tables are created unqualified, in the first schema on db's search path.
func Migrate(ctx context.Context, db *pgxpool.Pool) ([]string, error) {
	return migrate(ctx, db, schema.Migrations)
}

// migrateLock is the advisory lock key Migrate holds. Any constant would do;
// this one is "habitcrf" in ASCII.
const migrateLock int64 = 0x6861626974637266

func migrate(ctx context.Context, db *pgxpool.Pool, fsys fs.FS) ([]string, error) {
	migrations, err := parseMigrations(fsys)
	if err != nil {
		return nil, err
	}
	// A session-level advisory lock belongs to one connection, so the whole
	// run holds this one.
	conn, err := db.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("habitcraft: migrate: connecting: %w", err)
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", migrateLock); err != nil {
		return nil, fmt.Errorf("habitcraft: migrate: taking the lock: %w", err)
	}
	defer func() {
		// A cancelled ctx must not leave the lock held on a pooled connection.
		_, _ = conn.Exec(context.WithoutCancel(ctx), "SELECT pg_advisory_unlock($1)", migrateLock)
	}()

	// dbmate's table, exactly: a run of either tool sees the other's rows.
	if _, err := conn.Exec(ctx, "CREATE TABLE IF NOT EXISTS schema_migrations (version varchar PRIMARY KEY)"); err != nil {
		return nil, fmt.Errorf("habitcraft: migrate: creating schema_migrations: %w", err)
	}
	done, err := recorded(ctx, conn.Conn())
	if err != nil {
		return nil, err
	}

	applied := []string{}
	for _, m := range migrations {
		if done[m.version] {
			continue
		}
		if err := apply(ctx, conn.Conn(), m); err != nil {
			return applied, fmt.Errorf("habitcraft: migrate: %s: %w", m.file, err)
		}
		applied = append(applied, m.version)
	}
	return applied, nil
}

func recorded(ctx context.Context, conn *pgx.Conn) (map[string]bool, error) {
	rows, err := conn.Query(ctx, "SELECT version FROM schema_migrations")
	if err != nil {
		return nil, fmt.Errorf("habitcraft: migrate: reading schema_migrations: %w", err)
	}
	versions, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, fmt.Errorf("habitcraft: migrate: reading schema_migrations: %w", err)
	}
	done := make(map[string]bool, len(versions))
	for _, v := range versions {
		done[v] = true
	}
	return done, nil
}

// apply runs one migration and records it. Exec without arguments uses the
// simple protocol, which takes a file of several statements.
func apply(ctx context.Context, conn *pgx.Conn, m migration) error {
	const record = "INSERT INTO schema_migrations (version) VALUES ($1)"
	if !m.transaction {
		if _, err := conn.Exec(ctx, m.up); err != nil {
			return err
		}
		_, err := conn.Exec(ctx, record, m.version)
		return err
	}
	return pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, m.up); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, record, m.version)
		return err
	})
}

// A migration is one file's up section.
type migration struct {
	file        string
	version     string
	up          string
	transaction bool
}

// migrationFile is dbmate's rule: a migration's name starts with its
// version, all digits. Other files are not migrations and are skipped.
var migrationFile = regexp.MustCompile(`^(\d+).*\.sql$`)

// parseMigrations reads every migration at the root of fsys, sorted by
// version as dbmate sorts them.
func parseMigrations(fsys fs.FS) ([]migration, error) {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, fmt.Errorf("habitcraft: migrate: listing migrations: %w", err)
	}
	var out []migration
	seen := map[string]string{}
	for _, e := range entries {
		if e.IsDir() || !migrationFile.MatchString(e.Name()) {
			continue
		}
		content, err := fs.ReadFile(fsys, e.Name())
		if err != nil {
			return nil, fmt.Errorf("habitcraft: migrate: %w", err)
		}
		m, err := parseMigration(e.Name(), string(content))
		if err != nil {
			return nil, err
		}
		if other, ok := seen[m.version]; ok {
			return nil, fmt.Errorf("habitcraft: migrate: %s and %s share version %s", other, m.file, m.version)
		}
		seen[m.version] = m.file
		out = append(out, m)
	}
	slices.SortFunc(out, func(a, b migration) int { return strings.Compare(a.version, b.version) })
	return out, nil
}

var (
	upMarker   = regexp.MustCompile(`(?m)^--\s*migrate:up(.*)$`)
	downMarker = regexp.MustCompile(`(?m)^--\s*migrate:down(.*)$`)
)

// parseMigration takes the up section of a dbmate migration: what follows
// its "-- migrate:up" line, up to a "-- migrate:down" line or the end.
func parseMigration(file, content string) (migration, error) {
	name := migrationFile.FindStringSubmatch(file)
	if name == nil {
		return migration{}, fmt.Errorf("habitcraft: migrate: %s is not named <version>_<description>.sql", file)
	}
	m := migration{file: file, version: name[1], transaction: true}
	ups := upMarker.FindAllStringSubmatchIndex(content, -1)
	switch len(ups) {
	case 0:
		return migration{}, fmt.Errorf("habitcraft: migrate: %s has no -- migrate:up line", file)
	case 1:
	default:
		return migration{}, fmt.Errorf("habitcraft: migrate: %s has more than one -- migrate:up line", file)
	}
	upStart, upEnd := ups[0][0], ups[0][1]
	end := len(content)
	if down := downMarker.FindStringIndex(content); down != nil {
		if down[0] < upStart {
			return migration{}, fmt.Errorf("habitcraft: migrate: %s has its down section before its up section", file)
		}
		end = down[0]
	}
	m.up = content[upEnd:end]

	for _, option := range strings.Fields(content[ups[0][2]:ups[0][3]]) {
		switch option {
		case "transaction:false":
			m.transaction = false
		case "transaction:true":
		default:
			return migration{}, fmt.Errorf("habitcraft: migrate: %s: unknown option %q", file, option)
		}
	}
	return m, nil
}
