package habitcraft

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// The value of a token's "type" claim, which says what it may be used for.
const (
	accessToken  = "access"
	refreshToken = "refresh"
)

const (
	accessTokenTTL  = 15 * time.Minute
	refreshTokenTTL = 7 * 24 * time.Hour
)

// minSecretLength is the shortest JWT secret the server accepts, in bytes.
const minSecretLength = 32

// Tokens are signed with a shared secret, so HS256 is the only algorithm the
// server uses. Verification accepts nothing else, whatever a token's own
// header claims.
var signingMethod = jwt.SigningMethodHS256

var (
	errTokenInvalid   = errors.New("invalid token")
	errTokenExpired   = errors.New("token expired")
	errTokenWrongType = errors.New("wrong token type")
)

// claims are the Node backend's, claim for claim, so a token either server
// issues verifies on the other while both run (same JWT_SECRET).
type claims struct {
	UserID string `json:"userId"`
	Type   string `json:"type"`
	jwt.RegisteredClaims
}

// tokens issues and verifies the access and refresh tokens.
type tokens struct {
	secret []byte
	now    func() time.Time
}

// A tokenPair is what a new or renewed session gets.
type tokenPair struct {
	access, refresh string
	refreshExpires  time.Time
}

func (t tokens) issue(userID uuid.UUID) (tokenPair, error) {
	access, _, err := t.sign(userID, accessToken, accessTokenTTL)
	if err != nil {
		return tokenPair{}, err
	}
	refresh, expires, err := t.sign(userID, refreshToken, refreshTokenTTL)
	if err != nil {
		return tokenPair{}, err
	}
	return tokenPair{access: access, refresh: refresh, refreshExpires: expires}, nil
}

func (t tokens) sign(userID uuid.UUID, kind string, ttl time.Duration) (string, time.Time, error) {
	now := t.now()
	expires := now.Add(ttl)
	token, err := jwt.NewWithClaims(signingMethod, claims{
		UserID: userID.String(),
		Type:   kind,
		RegisteredClaims: jwt.RegisteredClaims{
			// A unique ID, so two tokens issued in the same second still differ.
			ID:        uuid.NewString(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expires),
		},
	}).SignedString(t.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("signing a %s token: %w", kind, err)
	}
	return token, expires, nil
}

// verify returns the user a token of the given kind belongs to. The error is
// errTokenExpired, errTokenWrongType or errTokenInvalid.
func (t tokens) verify(token, kind string) (uuid.UUID, error) {
	var c claims
	_, err := jwt.ParseWithClaims(token, &c,
		func(*jwt.Token) (any, error) { return t.secret, nil },
		jwt.WithValidMethods([]string{signingMethod.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(t.now),
	)
	switch {
	case errors.Is(err, jwt.ErrTokenExpired):
		return uuid.Nil, errTokenExpired
	case err != nil:
		return uuid.Nil, errTokenInvalid
	case c.Type != kind:
		return uuid.Nil, errTokenWrongType
	}
	userID, err := uuid.Parse(c.UserID)
	if err != nil {
		return uuid.Nil, errTokenInvalid
	}
	return userID, nil
}

// hashToken is how a refresh token is stored: hex SHA-256, as the Node
// backend stores it, so sessions survive cutover.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
