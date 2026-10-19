package habitcraft

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var testSecret = []byte("test-jwt-secret-key-for-testing-only")

func testTokens(now time.Time) tokens {
	return tokens{secret: testSecret, now: func() time.Time { return now }}
}

func TestIssuedTokensVerifyAsTheirOwnType(t *testing.T) {
	user := uuid.New()
	tk := testTokens(time.Now())

	pair, err := tk.issue(user)
	if err != nil {
		t.Fatal(err)
	}

	if got, err := tk.verify(pair.access, accessToken); err != nil || got != user {
		t.Errorf("access: got %v, %v", got, err)
	}
	if got, err := tk.verify(pair.refresh, refreshToken); err != nil || got != user {
		t.Errorf("refresh: got %v, %v", got, err)
	}
	if want := time.Now().Add(refreshTokenTTL); pair.refreshExpires.Sub(want).Abs() > time.Minute {
		t.Errorf("refresh expires %v, want about %v", pair.refreshExpires, want)
	}
}

func TestEveryIssuedTokenIsUnique(t *testing.T) {
	user := uuid.New()
	tk := testTokens(time.Now())

	first, _ := tk.issue(user)
	second, _ := tk.issue(user)

	if first.access == second.access || first.refresh == second.refresh {
		t.Error("two pairs issued in the same second share a token; the jti should differ")
	}
}

// Tokens must stay interchangeable with the Node backend's through cutover:
// same claim names, same algorithm, same secret.
func TestTokensCarryTheNodeBackendsClaims(t *testing.T) {
	user := uuid.New()
	pair, _ := testTokens(time.Now()).issue(user)

	claims := jwt.MapClaims{}
	if _, err := jwt.ParseWithClaims(pair.access, claims, func(*jwt.Token) (any, error) { return testSecret, nil }); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"userId", "type", "jti", "iat", "exp"} {
		if _, ok := claims[name]; !ok {
			t.Errorf("claim %q missing from %v", name, claims)
		}
	}
	if claims["userId"] != user.String() || claims["type"] != "access" {
		t.Errorf("claims = %v", claims)
	}
}

func TestANodeIssuedTokenVerifies(t *testing.T) {
	user := uuid.New()
	// What jsonwebtoken.sign({ userId, type, jti }, secret, { expiresIn: '15m' }) produces.
	token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": user.String(),
		"type":   "access",
		"jti":    uuid.NewString(),
		"iat":    time.Now().Unix(),
		"exp":    time.Now().Add(15 * time.Minute).Unix(),
	}).SignedString(testSecret)

	if got, err := testTokens(time.Now()).verify(token, accessToken); err != nil || got != user {
		t.Errorf("got %v, %v", got, err)
	}
}

func TestTokensThatMustNotVerify(t *testing.T) {
	user := uuid.New()
	now := time.Now()
	pair, _ := testTokens(now).issue(user)
	sign := func(method jwt.SigningMethod, key any, claims jwt.MapClaims) string {
		token, err := jwt.NewWithClaims(method, claims).SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return token
	}
	valid := func() jwt.MapClaims {
		return jwt.MapClaims{"userId": user.String(), "type": "access", "exp": now.Add(time.Minute).Unix()}
	}
	withClaim := func(name string, value any) jwt.MapClaims {
		claims := valid()
		if value == nil {
			delete(claims, name)
		} else {
			claims[name] = value
		}
		return claims
	}

	cases := []struct {
		name  string
		token string
		want  error
	}{
		{"malformed", "not.a.jwt", errTokenInvalid},
		{"empty", "", errTokenInvalid},
		{"tampered", pair.access[:len(pair.access)-2] + "xx", errTokenInvalid},
		{"wrong secret", sign(jwt.SigningMethodHS256, []byte("some-other-secret-at-least-32-bytes!"), valid()), errTokenInvalid},
		{"other HMAC algorithm", sign(jwt.SigningMethodHS512, testSecret, valid()), errTokenInvalid},
		{"alg none", sign(jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, valid()), errTokenInvalid},
		{"expired", sign(jwt.SigningMethodHS256, testSecret, withClaim("exp", now.Add(-time.Second).Unix())), errTokenExpired},
		{"no expiry", sign(jwt.SigningMethodHS256, testSecret, withClaim("exp", nil)), errTokenInvalid},
		{"no user", sign(jwt.SigningMethodHS256, testSecret, withClaim("userId", nil)), errTokenInvalid},
		{"user not a UUID", sign(jwt.SigningMethodHS256, testSecret, withClaim("userId", "1")), errTokenInvalid},
		{"refresh token used as access", pair.refresh, errTokenWrongType},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := testTokens(now).verify(c.token, accessToken); !errors.Is(err, c.want) {
				t.Errorf("err = %v, want %v", err, c.want)
			}
		})
	}
}

func TestAnAccessTokenExpiresAfterFifteenMinutes(t *testing.T) {
	issued := time.Now()
	pair, _ := testTokens(issued).issue(uuid.New())

	if _, err := testTokens(issued.Add(accessTokenTTL-time.Second)).verify(pair.access, accessToken); err != nil {
		t.Errorf("just before expiry: %v", err)
	}
	if _, err := testTokens(issued.Add(accessTokenTTL+time.Second)).verify(pair.access, accessToken); !errors.Is(err, errTokenExpired) {
		t.Errorf("just after expiry: %v, want expired", err)
	}
}

func TestTokenHashesAreSHA256Hex(t *testing.T) {
	// The Node backend stores refresh tokens by this hash, so it must match
	// crypto.createHash('sha256').update(token).digest('hex').
	const want = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
	if got := hashToken("hello"); got != want {
		t.Errorf("hashToken = %s, want %s", got, want)
	}
	if len(hashToken(strings.Repeat("x", 500))) != 64 {
		t.Error("hash is not 64 hex characters")
	}
}
