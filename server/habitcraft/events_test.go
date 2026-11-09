package habitcraft

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"testing"
)

func TestAPanickingOnCompletionDoesNotChangeTheResponse(t *testing.T) {
	var logs bytes.Buffer
	a := newApp(t, func(c *Config) {
		c.Logger = slog.New(slog.NewTextHandler(&logs, nil))
		c.OnCompletion = func(context.Context, CompletionEvent) { panic("host bug") }
	})
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)

	w := a.checkOffDay(alice, h.Id, `{"date":"`+dateString(0)+`"}`)

	if w.Code != http.StatusCreated {
		t.Errorf("got %d %s", w.Code, w.Body)
	}
	if len(a.store.completionsOf(h.Id, nil, nil)) != 1 {
		t.Error("the completion was not kept")
	}
	if !strings.Contains(logs.String(), "host bug") {
		t.Errorf("the panic was not logged: %q", logs.String())
	}
}

func TestOnCompletionOutlivesTheRequest(t *testing.T) {
	// A client that hangs up mid-request cancels its context. The change is
	// committed by then, so the host still hears of it with a live context.
	var callbackErr error
	a := newApp(t, func(c *Config) {
		c.OnCompletion = func(ctx context.Context, _ CompletionEvent) {
			cancelRequest(ctx)
			callbackErr = ctx.Err()
		}
	})
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)

	ctx, cancel := context.WithCancel(context.Background())
	w := a.do(http.MethodPost, completionsPath(h.Id), `{"date":"`+dateString(0)+`"}`,
		bearer(alice.token), func(r *http.Request) {
			*r = *r.WithContext(context.WithValue(ctx, cancelKey{}, cancel))
		})

	if w.Code != http.StatusCreated || callbackErr != nil {
		t.Errorf("got %d, callback context %v", w.Code, callbackErr)
	}
}

type cancelKey struct{}

func cancelRequest(ctx context.Context) {
	if cancel, ok := ctx.Value(cancelKey{}).(context.CancelFunc); ok {
		cancel()
	}
}

func TestEachCompletionChangeIsOneEvent(t *testing.T) {
	var got []CompletionEvent
	a := newApp(t, func(c *Config) {
		c.OnCompletion = func(_ context.Context, e CompletionEvent) { got = append(got, e) }
	})
	alice := a.newUser()
	h := a.createHabit(alice, `{"name":"Run"}`)
	day := completionsPath(h.Id) + "/" + dateString(1)

	a.checkOffDay(alice, h.Id, `{"date":"`+dateString(1)+`","notes":" 5k "}`)
	a.checkOffDay(alice, h.Id, `{"date":"`+dateString(1)+`"}`) // 409
	a.as(alice, http.MethodPut, day, `{"notes":"  "}`)
	a.as(alice, http.MethodDelete, day, "")
	a.as(alice, http.MethodDelete, day, "")                                                                  // 404
	a.checkOffDay(alice, a.createHabit(a.newUser(), `{"name":"Theirs"}`).Id, `{"date":"`+dateString(1)+`"}`) // 404

	kinds := make([]CompletionKind, 0, len(got))
	for _, e := range got {
		kinds = append(kinds, e.Kind)
	}
	if want := []CompletionKind{Completed, NoteChanged, Uncompleted}; !slices.Equal(kinds, want) {
		t.Fatalf("got %v, want %v", kinds, want)
	}
	if got[0].Notes == nil || *got[0].Notes != "5k" {
		t.Errorf("Completed carries the stored note, trimmed: %v", got[0].Notes)
	}
	if got[1].Notes != nil {
		t.Errorf("a blank note is cleared, so NoteChanged carries nil: %q", *got[1].Notes)
	}
	if got[0].UserID != alice.id || got[0].HabitID != h.Id || !got[0].Date.Equal(daysAgo(1)) || got[0].At.IsZero() {
		t.Errorf("got %+v", got[0])
	}
}

func TestCompletionKindNames(t *testing.T) {
	for k, want := range map[CompletionKind]string{
		Completed: "Completed", Uncompleted: "Uncompleted", NoteChanged: "NoteChanged", 0: "CompletionKind(0)",
	} {
		if k.String() != want {
			t.Errorf("%d is %q, want %q", int(k), k.String(), want)
		}
	}
}
