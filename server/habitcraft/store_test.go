package habitcraft

import (
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// The store's rules, run against both stores: the fake the handler tests use,
// and pgStore on a real database. Running both keeps the fake honest.
//
// pgStore runs only when HABITCRAFT_TEST_DATABASE_URL names a database
// migrated with db/migrations, as CI's server-unit-tests job and
// scripts/test-all.sh provide. Each test makes its own users with unique
// emails, so the database needs no reset and may hold other data.

func TestFakeStore(t *testing.T) {
	testStore(t, func(*testing.T) store { return newFakeStore() })
}

func TestPostgresStore(t *testing.T) {
	url := os.Getenv("HABITCRAFT_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("HABITCRAFT_TEST_DATABASE_URL is not set")
	}
	pool, err := pgxpool.New(t.Context(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	testStore(t, func(*testing.T) store { return pgStore{pool: pool} })
}

func testStore(t *testing.T, open func(*testing.T) store) {
	t.Run("a created user can be found by email and id", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)

		byEmail, err := st.userByEmail(ctx, u.email)
		if err != nil || !sameUser(byEmail, u) {
			t.Errorf("by email: %+v, %v; want %+v", byEmail, err, u)
		}
		byID, err := st.userByID(ctx, u.id)
		if err != nil || !sameUser(byID, u) {
			t.Errorf("by id: %+v, %v; want %+v", byID, err, u)
		}
		if u.createdAt.IsZero() {
			t.Error("createdAt not filled in")
		}
	})

	t.Run("a missing user is errNoSuchUser", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		if _, err := st.userByEmail(ctx, uniqueEmail()); !errors.Is(err, errNoSuchUser) {
			t.Errorf("by email: %v", err)
		}
		if _, err := st.userByID(ctx, uuid.New()); !errors.Is(err, errNoSuchUser) {
			t.Errorf("by id: %v", err)
		}
	})

	t.Run("an email is taken once", func(t *testing.T) {
		st := open(t)
		u, _ := createTestUser(t, st)

		_, err := st.createUser(t.Context(), user{id: uuid.New(), email: u.email, name: "Twin", passwordHash: "x"}, newSession(uuid.Nil))
		if !errors.Is(err, errEmailTaken) {
			t.Errorf("err = %v, want errEmailTaken", err)
		}
	})

	t.Run("a session rotates once", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, first := createTestUser(t, st)
		second, third := newSession(u.id), newSession(u.id)

		if err := st.rotateSession(ctx, first.tokenHash, second); err != nil {
			t.Fatalf("first rotation: %v", err)
		}
		if err := st.rotateSession(ctx, first.tokenHash, third); !errors.Is(err, errSessionRevoked) {
			t.Errorf("rotating it again: %v, want errSessionRevoked", err)
		}
		if err := st.rotateSession(ctx, second.tokenHash, third); err != nil {
			t.Errorf("rotating its replacement: %v", err)
		}
	})

	t.Run("of two concurrent rotations one wins", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, first := createTestUser(t, st)

		const racers = 2
		errs := make([]error, racers)
		var wg sync.WaitGroup
		for i := range racers {
			wg.Go(func() { errs[i] = st.rotateSession(ctx, first.tokenHash, newSession(u.id)) })
		}
		wg.Wait()

		won, revoked := 0, 0
		for _, err := range errs {
			switch {
			case err == nil:
				won++
			case errors.Is(err, errSessionRevoked):
				revoked++
			default:
				t.Errorf("unexpected error: %v", err)
			}
		}
		if won != 1 || revoked != 1 {
			t.Errorf("%d won and %d were refused as revoked, want 1 and 1", won, revoked)
		}
	})

	t.Run("an unknown session does not rotate", func(t *testing.T) {
		st := open(t)
		u, _ := createTestUser(t, st)

		if err := st.rotateSession(t.Context(), hashToken(uuid.NewString()), newSession(u.id)); !errors.Is(err, errSessionUnknown) {
			t.Errorf("err = %v, want errSessionUnknown", err)
		}
	})

	t.Run("a session does not rotate into another user's", func(t *testing.T) {
		st := open(t)
		_, alices := createTestUser(t, st)
		bob, _ := createTestUser(t, st)

		if err := st.rotateSession(t.Context(), alices.tokenHash, newSession(bob.id)); !errors.Is(err, errSessionUnknown) {
			t.Errorf("err = %v, want errSessionUnknown", err)
		}
	})

	t.Run("an ended session does not rotate", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, first := createTestUser(t, st)

		if err := st.endSession(ctx, first.tokenHash); err != nil {
			t.Fatal(err)
		}
		if err := st.rotateSession(ctx, first.tokenHash, newSession(u.id)); !errors.Is(err, errSessionRevoked) {
			t.Errorf("err = %v, want errSessionRevoked", err)
		}
		if err := st.endSession(ctx, hashToken(uuid.NewString())); err != nil {
			t.Errorf("ending an unknown session: %v", err)
		}
	})

	t.Run("a password change ends every session but the new one", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, first := createTestUser(t, st)
		other := newSession(u.id)
		if err := st.startSession(ctx, other); err != nil {
			t.Fatal(err)
		}
		bystander, bystanders := createTestUser(t, st)
		next := newSession(u.id)

		if err := st.changePassword(ctx, u.id, "new-hash", next); err != nil {
			t.Fatal(err)
		}

		if got, _ := st.userByID(ctx, u.id); got.passwordHash != "new-hash" {
			t.Errorf("password hash = %q", got.passwordHash)
		}
		for name, old := range map[string]session{"first": first, "other": other} {
			if err := st.rotateSession(ctx, old.tokenHash, newSession(u.id)); !errors.Is(err, errSessionRevoked) {
				t.Errorf("%s session: %v, want errSessionRevoked", name, err)
			}
		}
		if err := st.rotateSession(ctx, next.tokenHash, newSession(u.id)); err != nil {
			t.Errorf("the new session: %v", err)
		}
		if err := st.rotateSession(ctx, bystanders.tokenHash, newSession(bystander.id)); err != nil {
			t.Errorf("another user's session was touched: %v", err)
		}
	})
}

// createTestUser stores a user with a unique email and its first session.
func createTestUser(t *testing.T, st store) (user, session) {
	t.Helper()
	id := uuid.New()
	first := newSession(id)
	u, err := st.createUser(t.Context(), user{id: id, email: uniqueEmail(), name: "Alice", passwordHash: "hash"}, first)
	if err != nil {
		t.Fatal(err)
	}
	return u, first
}

func newSession(userID uuid.UUID) session {
	return session{userID: userID, tokenHash: hashToken(uuid.NewString()), expiresAt: time.Now().Add(time.Hour).UTC().Truncate(time.Microsecond)}
}

func uniqueEmail() string {
	return "store-" + uuid.NewString() + "@example.com"
}

// sameUser compares users field by field: a time read back from Postgres
// may carry a different location for the same instant.
func sameUser(a, b user) bool {
	return a.id == b.id && a.email == b.email && a.name == b.name &&
		a.passwordHash == b.passwordHash && a.createdAt.Equal(b.createdAt)
}
