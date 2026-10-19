package habitcraft

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// uniqueViolation is Postgres's SQLSTATE for a duplicate key.
const uniqueViolation = "23505"

// pgStore is the store on the schema in db/migrations.
type pgStore struct {
	pool *pgxpool.Pool
}

var _ store = pgStore{}

func (p pgStore) createUser(ctx context.Context, u user, first session) (user, error) {
	err := pgx.BeginFunc(ctx, p.pool, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx,
			`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)
			 RETURNING created_at`,
			u.id, u.email, u.passwordHash, u.name,
		).Scan(&u.createdAt)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return errEmailTaken
		}
		if err != nil {
			return fmt.Errorf("inserting a user: %w", err)
		}
		return insertSession(ctx, tx, first)
	})
	return u, err
}

func (p pgStore) userByEmail(ctx context.Context, email string) (user, error) {
	return p.oneUser(ctx, `WHERE email = $1`, email)
}

func (p pgStore) userByID(ctx context.Context, id uuid.UUID) (user, error) {
	return p.oneUser(ctx, `WHERE id = $1`, id)
}

func (p pgStore) oneUser(ctx context.Context, where string, arg any) (user, error) {
	var u user
	err := p.pool.QueryRow(ctx,
		`SELECT id, email, name, password_hash, created_at FROM users `+where, arg,
	).Scan(&u.id, &u.email, &u.name, &u.passwordHash, &u.createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return user{}, errNoSuchUser
	}
	if err != nil {
		return user{}, fmt.Errorf("reading a user: %w", err)
	}
	return u, nil
}

func (p pgStore) startSession(ctx context.Context, s session) error {
	return insertSession(ctx, p.pool, s)
}

func (p pgStore) rotateSession(ctx context.Context, oldHash string, next session) error {
	return pgx.BeginFunc(ctx, p.pool, func(tx pgx.Tx) error {
		// The revoked = FALSE condition is what lets only one of two
		// concurrent rotations through: the second waits on the first's row
		// lock, then finds the row already revoked.
		tag, err := tx.Exec(ctx,
			`UPDATE refresh_tokens SET revoked = TRUE
			 WHERE token_hash = $1 AND user_id = $2 AND revoked = FALSE`,
			oldHash, next.userID,
		)
		if err != nil {
			return fmt.Errorf("revoking a refresh token: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return whyNotRotated(ctx, tx, oldHash, next.userID)
		}
		return insertSession(ctx, tx, next)
	})
}

// whyNotRotated tells a revoked session from one that never existed.
func whyNotRotated(ctx context.Context, tx pgx.Tx, tokenHash string, userID uuid.UUID) error {
	var revoked bool
	err := tx.QueryRow(ctx,
		`SELECT revoked FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2`,
		tokenHash, userID,
	).Scan(&revoked)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return errSessionUnknown
	case err != nil:
		return fmt.Errorf("reading a refresh token: %w", err)
	case revoked:
		return errSessionRevoked
	}
	return errors.New("refresh token neither rotated nor revoked")
}

func (p pgStore) endSession(ctx context.Context, tokenHash string) error {
	if _, err := p.pool.Exec(ctx,
		`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, tokenHash,
	); err != nil {
		return fmt.Errorf("revoking a refresh token: %w", err)
	}
	return nil
}

func (p pgStore) changePassword(ctx context.Context, userID uuid.UUID, passwordHash string, next session) error {
	return pgx.BeginFunc(ctx, p.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx,
			`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
			passwordHash, userID,
		); err != nil {
			return fmt.Errorf("updating a password: %w", err)
		}
		if _, err := tx.Exec(ctx,
			`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE`,
			userID,
		); err != nil {
			return fmt.Errorf("revoking refresh tokens: %w", err)
		}
		return insertSession(ctx, tx, next)
	})
}

func (p pgStore) updateUser(ctx context.Context, id uuid.UUID, name, email *string) (user, error) {
	u := user{id: id}
	err := p.pool.QueryRow(ctx,
		`UPDATE users SET name = COALESCE($2, name), email = COALESCE($3, email), updated_at = NOW()
		 WHERE id = $1
		 RETURNING email, name, password_hash, created_at`,
		id, name, email,
	).Scan(&u.email, &u.name, &u.passwordHash, &u.createdAt)
	var pgErr *pgconn.PgError
	switch {
	case errors.As(err, &pgErr) && pgErr.Code == uniqueViolation:
		return user{}, errEmailTaken
	case errors.Is(err, pgx.ErrNoRows):
		return user{}, errNoSuchUser
	case err != nil:
		return user{}, fmt.Errorf("updating a user: %w", err)
	}
	return u, nil
}

// deleteUser leans on the schema: habits, completions and refresh tokens all
// go with their user by ON DELETE CASCADE.
func (p pgStore) deleteUser(ctx context.Context, id uuid.UUID) error {
	tag, err := p.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting a user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errNoSuchUser
	}
	return nil
}

// executor is what insertSession needs, from a pool or a transaction.
type executor interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

func insertSession(ctx context.Context, db executor, s session) error {
	if _, err := db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		s.userID, s.tokenHash, s.expiresAt,
	); err != nil {
		return fmt.Errorf("storing a refresh token: %w", err)
	}
	return nil
}
