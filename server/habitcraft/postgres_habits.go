package habitcraft

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// The habit and completion half of pgStore. Every statement names the acting
// user, so another user's habit is indistinguishable from a missing one.

const habitColumns = `id, user_id, name, description, color, icon, status, created_at, updated_at`

func scanHabit(row pgx.Row) (habit, error) {
	var h habit
	err := row.Scan(&h.id, &h.userID, &h.name, &h.description, &h.color, &h.icon, &h.status, &h.createdAt, &h.updatedAt)
	return h, err
}

const completionColumns = `id, habit_id, date, notes, created_at`

func scanCompletion(row pgx.Row) (completion, error) {
	var c completion
	err := row.Scan(&c.id, &c.habitID, &c.date, &c.notes, &c.createdAt)
	return c, err
}

func (p pgStore) habits(ctx context.Context, userID uuid.UUID, status string, since time.Time) ([]habitWithCompletions, error) {
	rows, err := p.pool.Query(ctx,
		`SELECT `+habitColumns+` FROM habits
		 WHERE user_id = $1 AND ($2::text = '' OR status = $2)
		 ORDER BY created_at, id`,
		userID, status,
	)
	if err != nil {
		return nil, fmt.Errorf("listing habits: %w", err)
	}
	habits, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (habitWithCompletions, error) {
		h, err := scanHabit(row)
		return habitWithCompletions{habit: h, completions: []completion{}}, err
	})
	if err != nil {
		return nil, fmt.Errorf("listing habits: %w", err)
	}
	if len(habits) == 0 {
		return habits, nil
	}

	byID := make(map[uuid.UUID]*habitWithCompletions, len(habits))
	for i := range habits {
		byID[habits[i].id] = &habits[i]
	}
	rows, err = p.pool.Query(ctx,
		`SELECT c.id, c.habit_id, c.date, c.notes, c.created_at
		 FROM completions c JOIN habits h ON h.id = c.habit_id
		 WHERE h.user_id = $1 AND ($2::text = '' OR h.status = $2) AND c.date >= $3
		 ORDER BY c.date DESC`,
		userID, status, since,
	)
	if err != nil {
		return nil, fmt.Errorf("listing completions: %w", err)
	}
	completions, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (completion, error) {
		return scanCompletion(row)
	})
	if err != nil {
		return nil, fmt.Errorf("listing completions: %w", err)
	}
	for _, c := range completions {
		// A habit created between the two queries is not in byID.
		if h, ok := byID[c.habitID]; ok {
			h.completions = append(h.completions, c)
		}
	}
	return habits, nil
}

func (p pgStore) createHabit(ctx context.Context, h habit, limit int) (habit, error) {
	err := pgx.BeginFunc(ctx, p.pool, func(tx pgx.Tx) error {
		// Locking the user's row makes concurrent creates for one user take
		// turns, so the count below cannot go stale before the insert.
		if _, err := tx.Exec(ctx, `SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, h.userID); err != nil {
			return fmt.Errorf("locking a user: %w", err)
		}
		var count int
		if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM habits WHERE user_id = $1`, h.userID).Scan(&count); err != nil {
			return fmt.Errorf("counting habits: %w", err)
		}
		if count >= limit {
			return errHabitLimit
		}
		err := tx.QueryRow(ctx,
			`INSERT INTO habits (id, user_id, name, description, color, icon, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING created_at, updated_at`,
			h.id, h.userID, h.name, h.description, h.color, h.icon, h.status,
		).Scan(&h.createdAt, &h.updatedAt)
		if err != nil {
			return fmt.Errorf("inserting a habit: %w", err)
		}
		return nil
	})
	return h, err
}

func (p pgStore) updateHabit(ctx context.Context, userID, habitID uuid.UUID, c habitChanges) (habit, error) {
	h, err := scanHabit(p.pool.QueryRow(ctx,
		`UPDATE habits SET
		   name = $3,
		   description = CASE WHEN $4::boolean THEN $5 ELSE description END,
		   color = COALESCE($6, color),
		   icon = COALESCE($7, icon),
		   status = COALESCE($8, status),
		   updated_at = NOW()
		 WHERE id = $1 AND user_id = $2
		 RETURNING `+habitColumns,
		habitID, userID, c.name, c.setDescription, c.description, c.color, c.icon, c.status,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return habit{}, errNoSuchHabit
	}
	if err != nil {
		return habit{}, fmt.Errorf("updating a habit: %w", err)
	}
	return h, nil
}

// deleteHabit leans on ON DELETE CASCADE for the habit's completions.
func (p pgStore) deleteHabit(ctx context.Context, userID, habitID uuid.UUID) error {
	tag, err := p.pool.Exec(ctx, `DELETE FROM habits WHERE id = $1 AND user_id = $2`, habitID, userID)
	if err != nil {
		return fmt.Errorf("deleting a habit: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errNoSuchHabit
	}
	return nil
}

func (p pgStore) completions(ctx context.Context, userID, habitID uuid.UUID, from, to *time.Time) ([]completion, error) {
	if err := p.ownHabit(ctx, userID, habitID); err != nil {
		return nil, err
	}
	rows, err := p.pool.Query(ctx,
		`SELECT `+completionColumns+` FROM completions
		 WHERE habit_id = $1 AND ($2::date IS NULL OR date >= $2) AND ($3::date IS NULL OR date <= $3)
		 ORDER BY date DESC`,
		habitID, from, to,
	)
	if err != nil {
		return nil, fmt.Errorf("listing completions: %w", err)
	}
	completions, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (completion, error) {
		return scanCompletion(row)
	})
	if err != nil {
		return nil, fmt.Errorf("listing completions: %w", err)
	}
	return completions, nil
}

func (p pgStore) createCompletion(ctx context.Context, userID uuid.UUID, c completion) (completion, error) {
	// The ownership check is inside the insert, so the habit cannot change
	// hands, or go, between the two.
	err := p.pool.QueryRow(ctx,
		`INSERT INTO completions (id, habit_id, date, notes)
		 SELECT $1, $2, $3, $4 WHERE EXISTS (SELECT 1 FROM habits WHERE id = $2 AND user_id = $5)
		 RETURNING created_at`,
		c.id, c.habitID, c.date, c.notes, userID,
	).Scan(&c.createdAt)
	var pgErr *pgconn.PgError
	switch {
	case errors.As(err, &pgErr) && pgErr.Code == uniqueViolation:
		return completion{}, errAlreadyCompleted
	case errors.Is(err, pgx.ErrNoRows):
		return completion{}, errNoSuchHabit
	case err != nil:
		return completion{}, fmt.Errorf("inserting a completion: %w", err)
	}
	return c, nil
}

func (p pgStore) setCompletionNote(ctx context.Context, userID, habitID uuid.UUID, date time.Time, notes *string) (completion, error) {
	if err := p.ownHabit(ctx, userID, habitID); err != nil {
		return completion{}, err
	}
	c, err := scanCompletion(p.pool.QueryRow(ctx,
		`UPDATE completions SET notes = $3 WHERE habit_id = $1 AND date = $2
		 RETURNING `+completionColumns,
		habitID, date, notes,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return completion{}, errNoSuchCompletion
	}
	if err != nil {
		return completion{}, fmt.Errorf("updating a completion: %w", err)
	}
	return c, nil
}

func (p pgStore) deleteCompletion(ctx context.Context, userID, habitID uuid.UUID, date time.Time) error {
	if err := p.ownHabit(ctx, userID, habitID); err != nil {
		return err
	}
	tag, err := p.pool.Exec(ctx, `DELETE FROM completions WHERE habit_id = $1 AND date = $2`, habitID, date)
	if err != nil {
		return fmt.Errorf("deleting a completion: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errNoSuchCompletion
	}
	return nil
}

// ownHabit returns errNoSuchHabit unless the habit is the user's.
func (p pgStore) ownHabit(ctx context.Context, userID, habitID uuid.UUID) error {
	var one int
	err := p.pool.QueryRow(ctx, `SELECT 1 FROM habits WHERE id = $1 AND user_id = $2`, habitID, userID).Scan(&one)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNoSuchHabit
	}
	if err != nil {
		return fmt.Errorf("reading a habit: %w", err)
	}
	return nil
}
