package habitcraft

import (
	"errors"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

// countCompares counts bcrypt compares until the test ends. Each one costs
// the same, so the count is what timing would show.
func countCompares(t *testing.T) *int {
	t.Helper()
	n := 0
	real := compareHash
	compareHash = func(hash, password []byte) error {
		n++
		return real(hash, password)
	}
	t.Cleanup(func() { compareHash = real })
	return &n
}

func mustHash(t *testing.T, password string) string {
	t.Helper()
	hash, err := hashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	return hash
}

// The legacy fallback (habitcraft-ti91): Node hashed nodeTransform(typed), so
// a password it altered verifies only through that form.
func TestCheckPassword(t *testing.T) {
	for _, tc := range []struct {
		name, stored, typed string
		ok, legacy          bool
		compares            int
	}{
		{"the password as typed", "a<b>c1234", "a<b>c1234", true, false, 1},
		{"a wrong password the transform leaves alone", "Correct-Horse-1", "Wrong-Horse-1", false, false, 1},
		{"a password Node altered, typed as it was then", "ac1234", "a<b>c1234", true, true, 2},
		{"whitespace Node trimmed", "lead trail", " lead trail ", true, true, 2},
		{"an escaped >", "a&gt;b12345", "a>b12345", true, true, 2},
		{"a wrong password the transform alters", "Correct-Horse-1", "Wrong<b>Horse", false, false, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			hash := mustHash(t, tc.stored)
			compares := countCompares(t)

			ok, legacy, err := checkPassword(hash, tc.typed)

			if err != nil || ok != tc.ok || legacy != tc.legacy {
				t.Errorf("got ok=%v legacy=%v err=%v; want ok=%v legacy=%v", ok, legacy, err, tc.ok, tc.legacy)
			}
			if *compares != tc.compares {
				t.Errorf("%d compares, want %d", *compares, tc.compares)
			}
		})
	}
}

// Node's bcrypt read only the first 72 bytes of the transformed form, so the
// fallback cuts that form, not the typed one.
func TestCheckPasswordCutsTheTransformedFormAt72Bytes(t *testing.T) {
	typed := strings.Repeat("a", 68) + ">" + strings.Repeat("b", 10) // ">" grows to "&gt;" across byte 72
	hash := mustHash(t, nodeTransform(typed))

	if ok, legacy, err := checkPassword(hash, typed); !ok || !legacy || err != nil {
		t.Errorf("got ok=%v legacy=%v err=%v", ok, legacy, err)
	}
}

// A transform that changes only bytes past 72 gives the same bcrypt input,
// so a second compare could only repeat the first.
func TestNoSecondCompareWhenOnlyBytesPast72Change(t *testing.T) {
	typed := strings.Repeat("a", 80) + " "
	hash := mustHash(t, "something else")
	compares := countCompares(t)

	if ok, _, _ := checkPassword(hash, typed); ok {
		t.Error("matched")
	}
	if *compares != 1 {
		t.Errorf("%d compares, want 1", *compares)
	}
}

func TestCheckPasswordReturnsAnythingButAMismatch(t *testing.T) {
	t.Run("from the first compare, without trying the second", func(t *testing.T) {
		compares := countCompares(t)
		_, _, err := checkPassword("not a bcrypt hash", "a<b>c1234")
		if err == nil || errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			t.Errorf("err = %v", err)
		}
		if *compares != 1 {
			t.Errorf("%d compares, want 1", *compares)
		}
	})
	t.Run("from the second compare", func(t *testing.T) {
		broken := errors.New("broken")
		calls := 0
		real := compareHash
		compareHash = func([]byte, []byte) error {
			calls++
			if calls == 1 {
				return bcrypt.ErrMismatchedHashAndPassword
			}
			return broken
		}
		t.Cleanup(func() { compareHash = real })

		ok, legacy, err := checkPassword("any", "a<b>c1234")
		if ok || legacy || !errors.Is(err, broken) {
			t.Errorf("got ok=%v legacy=%v err=%v", ok, legacy, err)
		}
	})
}

// The decoy check for an unknown email must cost what a wrong password costs
// for a real account, or the time taken says which emails have one.
func TestTheDecoyCheckCostsWhatAWrongPasswordDoes(t *testing.T) {
	hash := mustHash(t, alicePassword)
	compares := countCompares(t)
	for _, password := range []string{"Wrong-Horse-1", "Wrong<b>Horse", " spaced "} {
		before := *compares
		_, _, _ = checkPassword(hash, password)
		wrong := *compares - before

		before = *compares
		spendPasswordCheck(password)
		decoy := *compares - before

		if decoy != wrong {
			t.Errorf("%q: decoy did %d compares, a wrong password %d", password, decoy, wrong)
		}
	}
}
