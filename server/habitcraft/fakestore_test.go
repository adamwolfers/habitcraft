package habitcraft

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

// fakeStore keeps users and sessions in memory, with the same rules as
// pgStore. Unit tests use it; the SQL itself is exercised by the acceptance
// suite running against the server.
type fakeStore struct {
	mu       sync.Mutex
	users    map[uuid.UUID]user
	sessions map[string]*fakeSession // by token hash
	err      error                   // when set, every method fails with it
}

type fakeSession struct {
	session
	revoked bool
}

var _ store = (*fakeStore)(nil)

func newFakeStore() *fakeStore {
	return &fakeStore{users: map[uuid.UUID]user{}, sessions: map[string]*fakeSession{}}
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
