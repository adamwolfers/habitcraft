package habitcraft

import (
	"crypto/rand"
	"errors"
	"fmt"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

// passwordCost is bcrypt's work factor, the Node backend's 10 rounds, so
// hashes from either server verify on the other. Tests lower it.
var passwordCost = 10

// bcrypt reads only the first 72 bytes of a password. Go's bcrypt refuses a
// longer one where the Node backend's silently ignores the rest, and the spec
// allows 72 characters, which can be more bytes than that. Cutting it here
// matches Node, so a password hashed by either server verifies on both.
const bcryptMaxBytes = 72

func truncated(password string) []byte {
	b := []byte(password)
	if len(b) > bcryptMaxBytes {
		b = b[:bcryptMaxBytes]
	}
	return b
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword(truncated(password), passwordCost)
	if err != nil {
		return "", fmt.Errorf("hashing a password: %w", err)
	}
	return string(hash), nil
}

// compareHash is the one bcrypt compare every check goes through. Tests count
// the calls, since the count is what the time a check takes reveals.
var compareHash = bcrypt.CompareHashAndPassword

// checkPassword reports whether typed is the password hash was made from. Every
// caller that checks a stored password goes through it.
//
// The Node backend hashed nodeTransform(typed), not typed, so a password with
// a < or > in it, or whitespace at either end, made there matches only in that
// form (habitcraft-ti91). When typed does not match, checkPassword tries that
// form too, and legacy reports that only it matched, so the caller can log it
// and store a hash of typed in its place. Anything Node would have accepted
// for the account is accepted, which is no more than Node accepted.
func checkPassword(hash, typed string) (ok, legacy bool, err error) {
	ok, err = passwordMatches(hash, typed)
	if ok || err != nil {
		return ok, false, err
	}
	form, differs := legacyForm(typed)
	if !differs {
		return false, false, nil
	}
	ok, err = passwordMatches(hash, form)
	return ok, ok, err
}

// legacyForm is what the Node backend would have hashed in typed's place, and
// whether bcrypt would see it differently from typed. When it would not, a
// second compare could only repeat the first, so none is made: a password
// the transform leaves alone costs one compare, as it always did.
func legacyForm(typed string) (form string, differs bool) {
	form = nodeTransform(typed)
	return form, string(truncated(form)) != string(truncated(typed))
}

// passwordMatches reports whether password is the one hash was made from. Any
// error other than a mismatch, such as a corrupt hash, is returned.
func passwordMatches(hash, password string) (bool, error) {
	err := compareHash([]byte(hash), truncated(password))
	if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("checking a password: %w", err)
	}
	return true, nil
}

var (
	decoyOnce sync.Once
	decoy     string
)

// spendPasswordCheck does the work of one failed password check against a
// decoy hash. Login calls it for an email nobody registered, so that answer
// takes as long as a wrong password does, and timing does not reveal who has
// an account. A wrong password checkPassword tries twice is tried twice here.
func spendPasswordCheck(password string) {
	decoyOnce.Do(func() {
		secret := make([]byte, 16)
		_, _ = rand.Read(secret)
		hash, _ := bcrypt.GenerateFromPassword(secret, passwordCost)
		decoy = string(hash)
	})
	_ = compareHash([]byte(decoy), truncated(password))
	if form, differs := legacyForm(password); differs {
		_ = compareHash([]byte(decoy), truncated(form))
	}
}
