package habitcraft

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	errNoSuchUser = errors.New("no such user")
	errEmailTaken = errors.New("email already registered")
	// A refresh token the database has no record of.
	errSessionUnknown = errors.New("unknown refresh token")
	// A refresh token already used, or ended by a logout or password change.
	errSessionRevoked = errors.New("refresh token revoked")
)

// A user as stored, password hash included. It never leaves the package.
type user struct {
	id           uuid.UUID
	email        string
	name         string
	passwordHash string
	createdAt    time.Time
}

// A session is one stored refresh token: its hash, never the token itself.
type session struct {
	userID    uuid.UUID
	tokenHash string
	expiresAt time.Time
}

// store is the slice of the database the auth and user operations need. Each
// method that writes more than one row does so atomically.
type store interface {
	// createUser saves u and starts its first session. It returns u with
	// createdAt filled in, or errEmailTaken.
	createUser(ctx context.Context, u user, first session) (user, error)
	// userByEmail and userByID return errNoSuchUser when there is none.
	userByEmail(ctx context.Context, email string) (user, error)
	userByID(ctx context.Context, id uuid.UUID) (user, error)
	startSession(ctx context.Context, s session) error
	// rotateSession revokes the session whose token hashes to oldHash and
	// starts next in its place. It fails with errSessionUnknown when there is
	// no such session for next.userID, and with errSessionRevoked when it was
	// already revoked. Of two concurrent rotations of one session, only one
	// succeeds.
	rotateSession(ctx context.Context, oldHash string, next session) error
	// endSession revokes a session. An unknown hash is not an error.
	endSession(ctx context.Context, tokenHash string) error
	// changePassword sets the user's password hash, revokes every session
	// the user has, and starts next, all at once.
	changePassword(ctx context.Context, userID uuid.UUID, passwordHash string, next session) error
}
