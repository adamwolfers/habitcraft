package habitcraft

import (
	"errors"
	"os"
	"slices"
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
	testUserStore(t, open)
	testHabitStore(t, open)
	testCompletionStore(t, open)

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

func testUserStore(t *testing.T, open func(*testing.T) store) {
	t.Run("a user's name and email can change, apart or together", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		name, email := "Alice Jones", uniqueEmail()

		got, err := st.updateUser(ctx, u.id, &name, nil)
		if err != nil || got.name != name || got.email != u.email {
			t.Errorf("name only: %+v, %v", got, err)
		}
		got, err = st.updateUser(ctx, u.id, nil, &email)
		if err != nil || got.name != name || got.email != email {
			t.Errorf("email only: %+v, %v", got, err)
		}
		if stored, _ := st.userByID(ctx, u.id); !sameUser(stored, got) {
			t.Errorf("stored %+v, returned %+v", stored, got)
		}
	})

	t.Run("a user cannot take another user's email, but can keep their own", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		alice, _ := createTestUser(t, st)
		bob, _ := createTestUser(t, st)

		if _, err := st.updateUser(ctx, alice.id, nil, &bob.email); !errors.Is(err, errEmailTaken) {
			t.Errorf("taking bob's: %v, want errEmailTaken", err)
		}
		if _, err := st.updateUser(ctx, alice.id, nil, &alice.email); err != nil {
			t.Errorf("keeping her own: %v", err)
		}
	})

	t.Run("a missing user cannot change or be deleted", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		name := "Nobody"
		if _, err := st.updateUser(ctx, uuid.New(), &name, nil); !errors.Is(err, errNoSuchUser) {
			t.Errorf("update: %v", err)
		}
		if err := st.deleteUser(ctx, uuid.New()); !errors.Is(err, errNoSuchUser) {
			t.Errorf("delete: %v", err)
		}
	})

	t.Run("a deleted user takes their habits, completions and sessions", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		alice, session := createTestUser(t, st)
		run := createTestHabit(t, st, alice.id, "Run")
		checkOff(t, st, alice.id, run.id, daysAgo(0))
		bob, bobs := createTestUser(t, st)
		read := createTestHabit(t, st, bob.id, "Read")
		checkOff(t, st, bob.id, read.id, daysAgo(0))

		if err := st.deleteUser(ctx, alice.id); err != nil {
			t.Fatal(err)
		}

		if _, err := st.userByID(ctx, alice.id); !errors.Is(err, errNoSuchUser) {
			t.Errorf("user: %v", err)
		}
		if err := st.rotateSession(ctx, session.tokenHash, newSession(alice.id)); !errors.Is(err, errSessionUnknown) {
			t.Errorf("session: %v, want errSessionUnknown", err)
		}
		if habits, err := st.habits(ctx, alice.id, "", daysAgo(10)); err != nil || len(habits) != 0 {
			t.Errorf("habits: %+v, %v", habits, err)
		}
		if habits, _ := st.habits(ctx, bob.id, "", daysAgo(10)); len(habits) != 1 || len(habits[0].completions) != 1 {
			t.Errorf("bob's habits were touched: %+v", habits)
		}
		if err := st.rotateSession(ctx, bobs.tokenHash, newSession(bob.id)); err != nil {
			t.Errorf("bob's session was touched: %v", err)
		}
	})
}

func testHabitStore(t *testing.T, open func(*testing.T) store) {
	t.Run("habits are listed oldest first, with the timestamps filled in", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		first := createTestHabit(t, st, u.id, "First")
		second := createTestHabit(t, st, u.id, "Second")

		habits, err := st.habits(ctx, u.id, "", daysAgo(0))
		if err != nil {
			t.Fatal(err)
		}
		if names := habitNames(habits); !slices.Equal(names, []string{"First", "Second"}) {
			t.Errorf("habits = %v", names)
		}
		if !sameHabit(habits[0].habit, first) || !sameHabit(habits[1].habit, second) {
			t.Errorf("listed %+v, created %+v and %+v", habits, first, second)
		}
		if first.createdAt.IsZero() || first.updatedAt.IsZero() {
			t.Errorf("timestamps not filled in: %+v", first)
		}
	})

	t.Run("habits can be listed by status", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		createTestHabit(t, st, u.id, "Active")
		archived := createTestHabit(t, st, u.id, "Archived")
		status := "archived"
		if _, err := st.updateHabit(ctx, u.id, archived.id, habitChanges{name: archived.name, status: &status}); err != nil {
			t.Fatal(err)
		}

		for status, want := range map[string][]string{"": {"Active", "Archived"}, "active": {"Active"}, "archived": {"Archived"}} {
			habits, err := st.habits(ctx, u.id, status, daysAgo(0))
			if names := habitNames(habits); err != nil || !slices.Equal(names, want) {
				t.Errorf("status %q: %v, %v; want %v", status, names, err, want)
			}
		}
	})

	t.Run("a listed habit carries its completions since the given day, newest first", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		h := createTestHabit(t, st, u.id, "Run")
		for _, ago := range []int{5, 0, 3, 9} {
			checkOff(t, st, u.id, h.id, daysAgo(ago))
		}

		habits, err := st.habits(ctx, u.id, "", daysAgo(5))
		if err != nil || len(habits) != 1 {
			t.Fatalf("%+v, %v", habits, err)
		}
		if days := completionDays(habits[0].completions); !slices.Equal(days, []int{0, 3, 5}) {
			t.Errorf("completions %v days ago, want [0 3 5]", days)
		}
	})

	t.Run("habits between two days carry only those days' completions, every habit listed", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		bob, _ := createTestUser(t, st)
		run := createTestHabit(t, st, u.id, "Run")
		read := createTestHabit(t, st, u.id, "Read")
		status := "archived"
		if _, err := st.updateHabit(ctx, u.id, read.id, habitChanges{name: "Read", status: &status}); err != nil {
			t.Fatal(err)
		}
		createTestHabit(t, st, u.id, "Stretch")
		createTestHabit(t, st, bob.id, "Bob's")
		for _, ago := range []int{6, 0, 3, 2, 7} {
			checkOff(t, st, u.id, run.id, daysAgo(ago))
		}
		checkOff(t, st, u.id, read.id, daysAgo(4))

		habits, err := st.habitsBetween(ctx, u.id, daysAgo(6), daysAgo(1))
		if err != nil {
			t.Fatal(err)
		}
		var names []string
		for _, h := range habits {
			names = append(names, h.name)
		}
		if !slices.Equal(names, []string{"Run", "Read", "Stretch"}) {
			t.Fatalf("habits %v", names)
		}
		if days := completionDays(habits[0].completions); !slices.Equal(days, []int{2, 3, 6}) {
			t.Errorf("Run's completions %v days ago, want [2 3 6]", days)
		}
		if days := completionDays(habits[1].completions); !slices.Equal(days, []int{4}) {
			t.Errorf("Read's completions %v days ago, want [4]", days)
		}
		if habits[2].completions == nil || len(habits[2].completions) != 0 {
			t.Errorf("Stretch %#v, want an empty list", habits[2].completions)
		}
	})

	t.Run("a habit with no completions lists an empty list", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		createTestHabit(t, st, u.id, "Run")

		habits, err := st.habits(ctx, u.id, "", daysAgo(0))
		if err != nil || len(habits) != 1 || habits[0].completions == nil || len(habits[0].completions) != 0 {
			t.Errorf("%+v, %v", habits, err)
		}
	})

	t.Run("one user's habits are not another's", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		alice, _ := createTestUser(t, st)
		bob, _ := createTestUser(t, st)
		run := createTestHabit(t, st, alice.id, "Run")
		checkOff(t, st, alice.id, run.id, daysAgo(0))

		if habits, err := st.habits(ctx, bob.id, "", daysAgo(0)); err != nil || len(habits) != 0 {
			t.Errorf("bob sees %+v, %v", habits, err)
		}
		if _, err := st.updateHabit(ctx, bob.id, run.id, habitChanges{name: "Mine now"}); !errors.Is(err, errNoSuchHabit) {
			t.Errorf("update: %v", err)
		}
		if err := st.deleteHabit(ctx, bob.id, run.id); !errors.Is(err, errNoSuchHabit) {
			t.Errorf("delete: %v", err)
		}
		if _, err := st.completions(ctx, bob.id, run.id, nil, nil); !errors.Is(err, errNoSuchHabit) {
			t.Errorf("list completions: %v", err)
		}
		if _, err := st.createCompletion(ctx, bob.id, completion{id: uuid.New(), habitID: run.id, date: daysAgo(1)}); !errors.Is(err, errNoSuchHabit) {
			t.Errorf("check off: %v", err)
		}
		note := "mine"
		if _, err := st.setCompletionNote(ctx, bob.id, run.id, daysAgo(0), &note); !errors.Is(err, errNoSuchHabit) {
			t.Errorf("set a note: %v", err)
		}
		if err := st.deleteCompletion(ctx, bob.id, run.id, daysAgo(0)); !errors.Is(err, errNoSuchHabit) {
			t.Errorf("uncheck: %v", err)
		}
		if habits, _ := st.habits(ctx, alice.id, "", daysAgo(0)); len(habits) != 1 || habits[0].name != "Run" || len(habits[0].completions) != 1 {
			t.Errorf("alice's habit was touched: %+v", habits)
		}
	})

	t.Run("a missing habit is errNoSuchHabit", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		if _, err := st.updateHabit(ctx, u.id, uuid.New(), habitChanges{name: "x"}); !errors.Is(err, errNoSuchHabit) {
			t.Errorf("update: %v", err)
		}
		if err := st.deleteHabit(ctx, u.id, uuid.New()); !errors.Is(err, errNoSuchHabit) {
			t.Errorf("delete: %v", err)
		}
		if _, err := st.completions(ctx, u.id, uuid.New(), nil, nil); !errors.Is(err, errNoSuchHabit) {
			t.Errorf("completions: %v", err)
		}
	})

	t.Run("a user has at most limit habits", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		createTestHabit(t, st, u.id, "One")

		if _, err := st.createHabit(ctx, newHabit(u.id, "Two"), 2); err != nil {
			t.Errorf("the second of two: %v", err)
		}
		if _, err := st.createHabit(ctx, newHabit(u.id, "Three"), 2); !errors.Is(err, errHabitLimit) {
			t.Errorf("the third of two: %v, want errHabitLimit", err)
		}
		other, _ := createTestUser(t, st)
		if _, err := st.createHabit(ctx, newHabit(other.id, "Theirs"), 1); err != nil {
			t.Errorf("another user's first: %v", err)
		}
	})

	t.Run("of two concurrent creates at the limit one wins", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)

		const racers = 2
		errs := make([]error, racers)
		var wg sync.WaitGroup
		for i := range racers {
			wg.Go(func() { _, errs[i] = st.createHabit(ctx, newHabit(u.id, "Racer"), 1) })
		}
		wg.Wait()

		won, refused := 0, 0
		for _, err := range errs {
			switch {
			case err == nil:
				won++
			case errors.Is(err, errHabitLimit):
				refused++
			default:
				t.Errorf("unexpected error: %v", err)
			}
		}
		if won != 1 || refused != 1 {
			t.Errorf("%d won and %d were refused, want 1 and 1", won, refused)
		}
	})

	t.Run("an update changes what it names and keeps the rest", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		h := createTestHabit(t, st, u.id, "Run")
		color := "#FF0000"

		got, err := st.updateHabit(ctx, u.id, h.id, habitChanges{name: "Jog", color: &color})
		if err != nil {
			t.Fatal(err)
		}
		want := h
		want.name, want.color = "Jog", color
		want.updatedAt = got.updatedAt
		if !sameHabit(got, want) {
			t.Errorf("got %+v, want %+v", got, want)
		}
		if got.updatedAt.Before(h.updatedAt) {
			t.Errorf("updatedAt went back from %v to %v", h.updatedAt, got.updatedAt)
		}
	})

	t.Run("a description is changed or cleared only when asked", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		h := createTestHabit(t, st, u.id, "Run")
		text := "Around the park"

		got, _ := st.updateHabit(ctx, u.id, h.id, habitChanges{name: h.name, setDescription: true, description: &text})
		if got.description == nil || *got.description != text {
			t.Errorf("set: %v", got.description)
		}
		got, _ = st.updateHabit(ctx, u.id, h.id, habitChanges{name: h.name})
		if got.description == nil || *got.description != text {
			t.Errorf("left alone: %v", got.description)
		}
		got, _ = st.updateHabit(ctx, u.id, h.id, habitChanges{name: h.name, setDescription: true})
		if got.description != nil {
			t.Errorf("cleared: %q", *got.description)
		}
	})

	t.Run("a deleted habit takes its completions and leaves the others", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		run := createTestHabit(t, st, u.id, "Run")
		read := createTestHabit(t, st, u.id, "Read")
		checkOff(t, st, u.id, run.id, daysAgo(0))
		checkOff(t, st, u.id, read.id, daysAgo(0))

		if err := st.deleteHabit(ctx, u.id, run.id); err != nil {
			t.Fatal(err)
		}
		habits, _ := st.habits(ctx, u.id, "", daysAgo(0))
		if len(habits) != 1 || habits[0].id != read.id || len(habits[0].completions) != 1 {
			t.Errorf("left %+v", habits)
		}
		if _, err := st.completions(ctx, u.id, run.id, nil, nil); !errors.Is(err, errNoSuchHabit) {
			t.Errorf("the deleted habit's completions: %v", err)
		}
	})
}

func testCompletionStore(t *testing.T, open func(*testing.T) store) {
	t.Run("a completion is listed as stored", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		h := createTestHabit(t, st, u.id, "Run")
		note := "5k"
		c, err := st.createCompletion(ctx, u.id, completion{id: uuid.New(), habitID: h.id, date: daysAgo(2), notes: &note})
		if err != nil {
			t.Fatal(err)
		}
		if c.createdAt.IsZero() {
			t.Error("createdAt not filled in")
		}

		list, err := st.completions(ctx, u.id, h.id, nil, nil)
		if err != nil || len(list) != 1 || !sameCompletion(list[0], c) {
			t.Errorf("listed %+v, %v; created %+v", list, err, c)
		}
	})

	t.Run("a day is completed once", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		h := createTestHabit(t, st, u.id, "Run")
		checkOff(t, st, u.id, h.id, daysAgo(0))

		_, err := st.createCompletion(ctx, u.id, completion{id: uuid.New(), habitID: h.id, date: daysAgo(0)})
		if !errors.Is(err, errAlreadyCompleted) {
			t.Errorf("err = %v, want errAlreadyCompleted", err)
		}
		other := createTestHabit(t, st, u.id, "Read")
		checkOff(t, st, u.id, other.id, daysAgo(0))
	})

	t.Run("completions are listed newest first, within the dates given", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		h := createTestHabit(t, st, u.id, "Run")
		for _, ago := range []int{1, 4, 2, 3, 0} {
			checkOff(t, st, u.id, h.id, daysAgo(ago))
		}
		from, to := daysAgo(3), daysAgo(1)

		for name, tc := range map[string]struct {
			from, to *time.Time
			want     []int
		}{
			"all":       {nil, nil, []int{0, 1, 2, 3, 4}},
			"from":      {&from, nil, []int{0, 1, 2, 3}},
			"to":        {nil, &to, []int{1, 2, 3, 4}},
			"from, to":  {&from, &to, []int{1, 2, 3}},
			"one day":   {&to, &to, []int{1}},
			"backwards": {&to, &from, []int{}},
		} {
			list, err := st.completions(ctx, u.id, h.id, tc.from, tc.to)
			if days := completionDays(list); err != nil || !slices.Equal(days, tc.want) {
				t.Errorf("%s: %v days ago, %v; want %v", name, days, err, tc.want)
			}
		}
	})

	t.Run("a note can be set and cleared", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		h := createTestHabit(t, st, u.id, "Run")
		c := checkOff(t, st, u.id, h.id, daysAgo(1))
		note := "Hilly"

		got, err := st.setCompletionNote(ctx, u.id, h.id, daysAgo(1), &note)
		want := c
		want.notes = &note
		if err != nil || !sameCompletion(got, want) {
			t.Errorf("set: %+v, %v; want %+v", got, err, want)
		}
		got, err = st.setCompletionNote(ctx, u.id, h.id, daysAgo(1), nil)
		if err != nil || got.notes != nil {
			t.Errorf("cleared: %+v, %v", got, err)
		}
	})

	t.Run("a day not completed has no note to set and nothing to delete", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		h := createTestHabit(t, st, u.id, "Run")
		checkOff(t, st, u.id, h.id, daysAgo(0))
		note := "x"

		if _, err := st.setCompletionNote(ctx, u.id, h.id, daysAgo(1), &note); !errors.Is(err, errNoSuchCompletion) {
			t.Errorf("set a note: %v", err)
		}
		if err := st.deleteCompletion(ctx, u.id, h.id, daysAgo(1)); !errors.Is(err, errNoSuchCompletion) {
			t.Errorf("delete: %v", err)
		}
	})

	t.Run("a deleted completion is gone and its day can be completed again", func(t *testing.T) {
		st, ctx := open(t), t.Context()
		u, _ := createTestUser(t, st)
		h := createTestHabit(t, st, u.id, "Run")
		checkOff(t, st, u.id, h.id, daysAgo(0))
		checkOff(t, st, u.id, h.id, daysAgo(1))

		if err := st.deleteCompletion(ctx, u.id, h.id, daysAgo(0)); err != nil {
			t.Fatal(err)
		}
		if list, _ := st.completions(ctx, u.id, h.id, nil, nil); !slices.Equal(completionDays(list), []int{1}) {
			t.Errorf("left %v days ago", completionDays(list))
		}
		checkOff(t, st, u.id, h.id, daysAgo(0))
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

func newHabit(userID uuid.UUID, name string) habit {
	return habit{id: uuid.New(), userID: userID, name: name, color: defaultColor, icon: defaultIcon, status: "active"}
}

func createTestHabit(t *testing.T, st store, userID uuid.UUID, name string) habit {
	t.Helper()
	h, err := st.createHabit(t.Context(), newHabit(userID, name), maxHabitsPerUser)
	if err != nil {
		t.Fatal(err)
	}
	return h
}

func checkOff(t *testing.T, st store, userID, habitID uuid.UUID, date time.Time) completion {
	t.Helper()
	c, err := st.createCompletion(t.Context(), userID, completion{id: uuid.New(), habitID: habitID, date: date})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

// daysAgo is midnight UTC on the day n days before today, as a stored date.
func daysAgo(n int) time.Time {
	return today().AddDate(0, 0, -n)
}

func habitNames(habits []habitWithCompletions) []string {
	names := []string{}
	for _, h := range habits {
		names = append(names, h.name)
	}
	return names
}

// completionDays says how many days ago each completion was.
func completionDays(list []completion) []int {
	days := []int{}
	for _, c := range list {
		days = append(days, int(today().Sub(c.date).Hours()/24))
	}
	return days
}

func sameHabit(a, b habit) bool {
	return a.id == b.id && a.userID == b.userID && a.name == b.name &&
		equalPtr(a.description, b.description) && a.color == b.color && a.icon == b.icon &&
		a.status == b.status && a.createdAt.Equal(b.createdAt) && a.updatedAt.Equal(b.updatedAt)
}

func sameCompletion(a, b completion) bool {
	return a.id == b.id && a.habitID == b.habitID && a.date.Equal(b.date) &&
		equalPtr(a.notes, b.notes) && a.createdAt.Equal(b.createdAt)
}

func equalPtr(a, b *string) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}
