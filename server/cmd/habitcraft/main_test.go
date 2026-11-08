package main

import "testing"

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
