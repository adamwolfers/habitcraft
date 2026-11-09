package habitcraft

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// A CompletionKind says what happened to a completed day.
type CompletionKind int

const (
	// Completed: a day was checked off.
	Completed CompletionKind = iota + 1
	// Uncompleted: a checked-off day was unchecked.
	Uncompleted
	// NoteChanged: a checked-off day's note was set or cleared.
	NoteChanged
)

func (k CompletionKind) String() string {
	switch k {
	case Completed:
		return "Completed"
	case Uncompleted:
		return "Uncompleted"
	case NoteChanged:
		return "NoteChanged"
	}
	return fmt.Sprintf("CompletionKind(%d)", int(k))
}

// A CompletionEvent is one change to a habit's completed days, passed to
// Config.OnCompletion once the change is committed.
type CompletionEvent struct {
	Kind    CompletionKind
	UserID  uuid.UUID
	HabitID uuid.UUID
	// Date is the day, as midnight UTC.
	Date time.Time
	// Notes is the day's note after the change, as stored: trimmed, and nil
	// when there is none. It is always nil for Uncompleted.
	Notes *string
	// At is when the server committed the change.
	At time.Time
}

// emit hands e to the host's OnCompletion, if it set one. The change is
// already committed, so nothing here may alter the response: the callback
// gets its own copy of the note, a panic is logged and swallowed, and the
// callback's context is not cancelled when the client goes away.
func (s *server) emit(ctx context.Context, e CompletionEvent) {
	if s.onCompletion == nil {
		return
	}
	e.At = time.Now()
	if e.Notes != nil {
		// The response is built from the same note after this returns.
		notes := *e.Notes
		e.Notes = &notes
	}
	ctx = context.WithoutCancel(ctx)
	defer func() {
		if r := recover(); r != nil {
			s.logger.ErrorContext(ctx, "OnCompletion panicked", "kind", e.Kind, "habit", e.HabitID, "panic", fmt.Sprint(r))
		}
	}()
	s.onCompletion(ctx, e)
}
