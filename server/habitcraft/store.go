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
	// A habit that does not exist, or belongs to another user: the two are
	// one error, so no caller can learn that another user's habit exists.
	errNoSuchHabit      = errors.New("no such habit")
	errHabitLimit       = errors.New("habit limit reached")
	errNoSuchCompletion = errors.New("no such completion")
	errAlreadyCompleted = errors.New("already completed on that date")
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

// A habit as stored. description is nil when there is none.
type habit struct {
	id          uuid.UUID
	userID      uuid.UUID
	name        string
	description *string
	color       string
	icon        string
	status      string
	createdAt   time.Time
	updatedAt   time.Time
}

// habitChanges is an update to a habit. name is always set; a nil field is
// left as it is, and description is changed only when setDescription is true,
// so it can be cleared to nil.
type habitChanges struct {
	name           string
	setDescription bool
	description    *string
	color          *string
	icon           *string
	status         *string
}

// A completion is one day a habit was done. date is midnight UTC of that day.
type completion struct {
	id        uuid.UUID
	habitID   uuid.UUID
	date      time.Time
	notes     *string
	createdAt time.Time
}

// habitWithCompletions is a habit and some of its completions, newest first.
type habitWithCompletions struct {
	habit
	completions []completion
}

// store is the slice of the database the operations need. Each method that
// writes more than one row does so atomically. Every habit and completion
// method takes the acting user and sees only that user's habits.
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

	// updateUser sets the user's name and email where they are not nil. It
	// returns errNoSuchUser, or errEmailTaken when another user has the email.
	updateUser(ctx context.Context, id uuid.UUID, name, email *string) (user, error)
	// deleteUser removes the user and everything they own: habits,
	// completions and sessions. It returns errNoSuchUser when there is none.
	deleteUser(ctx context.Context, id uuid.UUID) error

	// habits lists the user's habits, oldest first, with status "" meaning
	// any. Each carries its completions on or after since.
	habits(ctx context.Context, userID uuid.UUID, status string, since time.Time) ([]habitWithCompletions, error)
	// habitsBetween lists all the user's habits, oldest first, each with its
	// completions from from to to inclusive.
	habitsBetween(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]habitWithCompletions, error)
	// createHabit saves h unless the user already has limit habits, which is
	// errHabitLimit. It returns h with the timestamps filled in. Two
	// concurrent creates cannot both pass the limit.
	createHabit(ctx context.Context, h habit, limit int) (habit, error)
	updateHabit(ctx context.Context, userID, habitID uuid.UUID, changes habitChanges) (habit, error)
	// deleteHabit removes the habit and its completions.
	deleteHabit(ctx context.Context, userID, habitID uuid.UUID) error

	// habitStart returns when the habit was created and the day it was first
	// completed, nil when it never was. It returns errNoSuchHabit when the
	// user has no such habit.
	habitStart(ctx context.Context, userID, habitID uuid.UUID) (created time.Time, firstDone *time.Time, err error)
	// completions lists a habit's completions, newest first, between from and
	// to inclusive where they are not nil.
	completions(ctx context.Context, userID, habitID uuid.UUID, from, to *time.Time) ([]completion, error)
	// createCompletion saves c, or returns errAlreadyCompleted when the habit
	// has one on that date. It returns c with createdAt filled in.
	createCompletion(ctx context.Context, userID uuid.UUID, c completion) (completion, error)
	// setCompletionNote and deleteCompletion return errNoSuchCompletion when
	// the habit has none on that date.
	setCompletionNote(ctx context.Context, userID, habitID uuid.UUID, date time.Time, notes *string) (completion, error)
	deleteCompletion(ctx context.Context, userID, habitID uuid.UUID, date time.Time) error
}
