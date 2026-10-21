package habitcraft

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/google/uuid"
)

// fakeStore keeps everything in memory, with the same rules as pgStore.
// Handler tests use it; store_test.go holds both stores to one set of rules.
type fakeStore struct {
	mu        sync.Mutex
	users     map[uuid.UUID]user
	sessions  map[string]*fakeSession  // by token hash
	habitRows map[uuid.UUID]habit      // by habit id
	completed map[uuid.UUID]completion // by completion id
	last      time.Time                // the latest tick
	err       error                    // when set, every method fails with it
}

type fakeSession struct {
	session
	revoked bool
}

var _ store = (*fakeStore)(nil)

func newFakeStore() *fakeStore {
	return &fakeStore{
		users:     map[uuid.UUID]user{},
		sessions:  map[string]*fakeSession{},
		habitRows: map[uuid.UUID]habit{},
		completed: map[uuid.UUID]completion{},
	}
}

func (f *fakeStore) createUser(_ context.Context, u user, first session) (user, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return user{}, f.err
	}
	for _, existing := range f.users {
		if existing.email == u.email {
			return user{}, errEmailTaken
		}
	}
	u.createdAt = time.Now().UTC()
	f.users[u.id] = u
	f.sessions[first.tokenHash] = &fakeSession{session: first}
	return u, nil
}

func (f *fakeStore) userByEmail(_ context.Context, email string) (user, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return user{}, f.err
	}
	for _, u := range f.users {
		if u.email == email {
			return u, nil
		}
	}
	return user{}, errNoSuchUser
}

func (f *fakeStore) userByID(_ context.Context, id uuid.UUID) (user, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return user{}, f.err
	}
	u, ok := f.users[id]
	if !ok {
		return user{}, errNoSuchUser
	}
	return u, nil
}

func (f *fakeStore) startSession(_ context.Context, s session) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	f.sessions[s.tokenHash] = &fakeSession{session: s}
	return nil
}

func (f *fakeStore) rotateSession(_ context.Context, oldHash string, next session) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	old, ok := f.sessions[oldHash]
	switch {
	case !ok || old.userID != next.userID:
		return errSessionUnknown
	case old.revoked:
		return errSessionRevoked
	}
	old.revoked = true
	f.sessions[next.tokenHash] = &fakeSession{session: next}
	return nil
}

func (f *fakeStore) endSession(_ context.Context, tokenHash string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	if s, ok := f.sessions[tokenHash]; ok {
		s.revoked = true
	}
	return nil
}

func (f *fakeStore) changePassword(_ context.Context, userID uuid.UUID, passwordHash string, next session) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	u := f.users[userID]
	u.passwordHash = passwordHash
	f.users[userID] = u
	for _, s := range f.sessions {
		if s.userID == userID {
			s.revoked = true
		}
	}
	f.sessions[next.tokenHash] = &fakeSession{session: next}
	return nil
}

func (f *fakeStore) updateUser(_ context.Context, id uuid.UUID, name, email *string) (user, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return user{}, f.err
	}
	u, ok := f.users[id]
	if !ok {
		return user{}, errNoSuchUser
	}
	if email != nil {
		for _, other := range f.users {
			if other.id != id && other.email == *email {
				return user{}, errEmailTaken
			}
		}
		u.email = *email
	}
	if name != nil {
		u.name = *name
	}
	f.users[id] = u
	return u, nil
}

func (f *fakeStore) deleteUser(_ context.Context, id uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	if _, ok := f.users[id]; !ok {
		return errNoSuchUser
	}
	delete(f.users, id)
	for hash, s := range f.sessions {
		if s.userID == id {
			delete(f.sessions, hash)
		}
	}
	for _, h := range f.habitRows {
		if h.userID == id {
			f.removeHabit(h.id)
		}
	}
	return nil
}

func (f *fakeStore) habits(_ context.Context, userID uuid.UUID, status string, since time.Time) ([]habitWithCompletions, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	list := []habitWithCompletions{}
	for _, h := range f.habitRows {
		if h.userID == userID && (status == "" || h.status == status) {
			list = append(list, habitWithCompletions{habit: h, completions: f.completionsOf(h.id, &since, nil)})
		}
	}
	slices.SortFunc(list, func(a, b habitWithCompletions) int { return a.createdAt.Compare(b.createdAt) })
	return list, nil
}

func (f *fakeStore) habitsBetween(_ context.Context, userID uuid.UUID, from, to time.Time) ([]habitWithCompletions, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	list := []habitWithCompletions{}
	for _, h := range f.habitRows {
		if h.userID == userID {
			list = append(list, habitWithCompletions{habit: h, completions: f.completionsOf(h.id, &from, &to)})
		}
	}
	slices.SortFunc(list, func(a, b habitWithCompletions) int { return a.createdAt.Compare(b.createdAt) })
	return list, nil
}

func (f *fakeStore) createHabit(_ context.Context, h habit, limit int) (habit, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return habit{}, f.err
	}
	count := 0
	for _, existing := range f.habitRows {
		if existing.userID == h.userID {
			count++
		}
	}
	if count >= limit {
		return habit{}, errHabitLimit
	}
	h.createdAt = f.tick()
	h.updatedAt = h.createdAt
	f.habitRows[h.id] = h
	return h, nil
}

func (f *fakeStore) updateHabit(_ context.Context, userID, habitID uuid.UUID, c habitChanges) (habit, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return habit{}, f.err
	}
	h, ok := f.habitRows[habitID]
	if !ok || h.userID != userID {
		return habit{}, errNoSuchHabit
	}
	h.name = c.name
	if c.setDescription {
		h.description = c.description
	}
	for field, value := range map[*string]*string{&h.color: c.color, &h.icon: c.icon, &h.status: c.status} {
		if value != nil {
			*field = *value
		}
	}
	h.updatedAt = f.tick()
	f.habitRows[habitID] = h
	return h, nil
}

func (f *fakeStore) deleteHabit(_ context.Context, userID, habitID uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	if h, ok := f.habitRows[habitID]; !ok || h.userID != userID {
		return errNoSuchHabit
	}
	f.removeHabit(habitID)
	return nil
}

func (f *fakeStore) completions(_ context.Context, userID, habitID uuid.UUID, from, to *time.Time) ([]completion, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	if h, ok := f.habitRows[habitID]; !ok || h.userID != userID {
		return nil, errNoSuchHabit
	}
	return f.completionsOf(habitID, from, to), nil
}

func (f *fakeStore) createCompletion(_ context.Context, userID uuid.UUID, c completion) (completion, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return completion{}, f.err
	}
	if h, ok := f.habitRows[c.habitID]; !ok || h.userID != userID {
		return completion{}, errNoSuchHabit
	}
	if _, ok := f.completionOn(c.habitID, c.date); ok {
		return completion{}, errAlreadyCompleted
	}
	c.createdAt = f.tick()
	f.completed[c.id] = c
	return c, nil
}

func (f *fakeStore) setCompletionNote(_ context.Context, userID, habitID uuid.UUID, date time.Time, notes *string) (completion, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return completion{}, f.err
	}
	if h, ok := f.habitRows[habitID]; !ok || h.userID != userID {
		return completion{}, errNoSuchHabit
	}
	c, ok := f.completionOn(habitID, date)
	if !ok {
		return completion{}, errNoSuchCompletion
	}
	c.notes = notes
	f.completed[c.id] = c
	return c, nil
}

func (f *fakeStore) deleteCompletion(_ context.Context, userID, habitID uuid.UUID, date time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	if h, ok := f.habitRows[habitID]; !ok || h.userID != userID {
		return errNoSuchHabit
	}
	c, ok := f.completionOn(habitID, date)
	if !ok {
		return errNoSuchCompletion
	}
	delete(f.completed, c.id)
	return nil
}

// completionsOf lists a habit's completions newest first, between from and
// to inclusive where they are not nil. The caller holds f.mu.
func (f *fakeStore) completionsOf(habitID uuid.UUID, from, to *time.Time) []completion {
	list := []completion{}
	for _, c := range f.completed {
		if c.habitID == habitID && (from == nil || !c.date.Before(*from)) && (to == nil || !c.date.After(*to)) {
			list = append(list, c)
		}
	}
	slices.SortFunc(list, func(a, b completion) int { return b.date.Compare(a.date) })
	return list
}

func (f *fakeStore) completionOn(habitID uuid.UUID, date time.Time) (completion, bool) {
	for _, c := range f.completed {
		if c.habitID == habitID && c.date.Equal(date) {
			return c, true
		}
	}
	return completion{}, false
}

func (f *fakeStore) removeHabit(habitID uuid.UUID) {
	delete(f.habitRows, habitID)
	for id, c := range f.completed {
		if c.habitID == habitID {
			delete(f.completed, id)
		}
	}
}

// tick is a timestamp later than any before it, so the order things were
// created in survives a clock too coarse to tell them apart.
func (f *fakeStore) tick() time.Time {
	now := time.Now().UTC()
	if !now.After(f.last) {
		now = f.last.Add(time.Microsecond)
	}
	f.last = now
	return now
}

// liveSessions counts a user's unrevoked sessions.
func (f *fakeStore) liveSessions(userID uuid.UUID) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, s := range f.sessions {
		if s.userID == userID && !s.revoked {
			n++
		}
	}
	return n
}
