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

// passwordMatches reports whether password is the one hash was made from. Any
// error other than a mismatch, such as a corrupt hash, is returned.
func passwordMatches(hash, password string) (bool, error) {
	err := bcrypt.CompareHashAndPassword([]byte(hash), truncated(password))
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

// spendPasswordCheck does the work of one password check against a decoy
// hash. Login calls it for an email nobody registered, so that answer takes
// as long as a wrong password does, and timing does not reveal who has an
// account.
func spendPasswordCheck(password string) {
	decoyOnce.Do(func() {
		secret := make([]byte, 16)
		_, _ = rand.Read(secret)
		hash, _ := bcrypt.GenerateFromPassword(secret, passwordCost)
		decoy = string(hash)
	})
	_ = bcrypt.CompareHashAndPassword([]byte(decoy), truncated(password))
}
