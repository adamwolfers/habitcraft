package main

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestTrustedProxyHopsDefaultsToKamalProxyAlone(t *testing.T) {
	if hops, err := trustedProxyHopsFromEnv(""); err != nil || hops != 1 {
		t.Errorf("unset: %d, %v; want 1", hops, err)
	}
}

func TestTrustedProxyHopsTakesACount(t *testing.T) {
	for value, want := range map[string]int{"0": 0, "2": 2} {
		if hops, err := trustedProxyHopsFromEnv(value); err != nil || hops != want {
			t.Errorf("%q: %d, %v; want %d", value, hops, err, want)
		}
	}
}

func TestAnUnusableTrustedProxyHopsIsAnError(t *testing.T) {
	// Never a fallback: a wrong count silently undoes the rate limits.
	for _, value := range []string{"-1", "1.5", "true", "one", " 1"} {
		if _, err := trustedProxyHopsFromEnv(value); err == nil {
			t.Errorf("%q was accepted", value)
		}
	}
}

func TestBoolFromEnv(t *testing.T) {
	t.Setenv("HABITCRAFT_TEST_BOOL", "")
	if got, err := boolFromEnv("HABITCRAFT_TEST_BOOL"); got || err != nil {
		t.Errorf("unset: %v, %v", got, err)
	}
	t.Setenv("HABITCRAFT_TEST_BOOL", "true")
	if got, err := boolFromEnv("HABITCRAFT_TEST_BOOL"); !got || err != nil {
		t.Errorf("true: %v, %v", got, err)
	}
	t.Setenv("HABITCRAFT_TEST_BOOL", "yes")
	if _, err := boolFromEnv("HABITCRAFT_TEST_BOOL"); err == nil {
		t.Error("yes was accepted")
	}
}

func TestCommandFromArgs(t *testing.T) {
	for args, want := range map[string]string{"": "serve", "migrate": "migrate"} {
		got, err := commandFrom(strings.Fields(args))
		if err != nil || got != want {
			t.Errorf("%q: %q, %v; want %q", args, got, err, want)
		}
	}
	for _, args := range []string{"serve", "migrate now", "up"} {
		if _, err := commandFrom(strings.Fields(args)); err == nil {
			t.Errorf("%q was accepted", args)
		}
	}
}

func TestWaitForDatabaseRetriesUntilItAnswers(t *testing.T) {
	calls := 0
	ping := func(context.Context) error {
		calls++
		if calls < 3 {
			return errors.New("connection refused")
		}
		return nil
	}
	if err := waitForDatabase(t.Context(), ping, time.Second, time.Millisecond); err != nil || calls != 3 {
		t.Errorf("%d calls, %v; want 3, nil", calls, err)
	}
}

func TestWaitForDatabaseGivesUpWithTheLastError(t *testing.T) {
	ping := func(context.Context) error { return errors.New("connection refused") }
	err := waitForDatabase(t.Context(), ping, 20*time.Millisecond, time.Millisecond)
	if err == nil || !strings.Contains(err.Error(), "connection refused") {
		t.Errorf("%v; want the ping's error", err)
	}
}
