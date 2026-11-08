package habitcraft

import (
	"errors"
	"fmt"
	"maps"
	"math"
	"net"
	"net/http"
	"net/netip"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/routers/gorillamux"

	"github.com/adamwolfers/habitcraft/server/api"
)

// A rateLimit is how many requests one client may make to one operation in a
// window, and the 429 it gets after that.
type rateLimit struct {
	max            int
	window         time.Duration
	error, message string
}

// rateLimits are the Node backend's, from backend/middleware/rateLimiter.js,
// keyed by operation as the embedded spec names it: oapi-codegen stores each
// operationId as its Go name (login becomes Login), the strict server's
// method. They must be exactly the operations the spec documents a 429 for;
// Handler refuses to start otherwise.
var rateLimits = map[string]rateLimit{
	"Register": {10, time.Hour,
		"Too many registration attempts", "Too many accounts created from this IP, please try again after an hour"},
	"Login": {15, 15 * time.Minute,
		"Too many login attempts", "Too many login attempts from this IP, please try again after 15 minutes"},
	"RefreshToken": {30, 15 * time.Minute,
		"Too many refresh attempts", "Too many token refresh attempts from this IP, please try again later"},
	"ChangePassword": {5, 15 * time.Minute,
		"Too many password change attempts", "Too many password change attempts from this IP, please try again after 15 minutes"},
	"DeleteCurrentUser": {5, 15 * time.Minute,
		"Too many deletion attempts", "Too many account deletion attempts from this IP, please try again after 15 minutes"},
}

// ipv6Prefix groups IPv6 clients by network, not address: one host is
// usually given a whole /64 or more, so counting each address would hand it
// billions of allowances. 56 is express-rate-limit's default.
const ipv6Prefix = 56

// sweepEvery is how often expired counts are dropped, so the limiter's memory
// follows the clients of the last window, not every client ever seen.
const sweepEvery = time.Minute

// limiter counts requests per operation and client in fixed windows, each
// starting at that client's first request, as express-rate-limit's memory
// store does. Counts live in this process only: a second instance of the
// server would count separately.
type limiter struct {
	mu        sync.Mutex
	now       func() time.Time
	counts    map[limitKey]*limitCount
	nextSweep time.Time
}

type limitKey struct{ operation, client string }

type limitCount struct {
	hits   int
	resets time.Time
}

func newLimiter() *limiter {
	return &limiter{now: time.Now, counts: map[limitKey]*limitCount{}}
}

// hit counts one request and reports what is left of the window. A refused
// request counts too, so hammering a limit does not wear it down any faster.
func (l *limiter) hit(operation, client string, limit rateLimit) (remaining int, resetIn time.Duration, allowed bool) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	if !now.Before(l.nextSweep) {
		for key, count := range l.counts {
			if !now.Before(count.resets) {
				delete(l.counts, key)
			}
		}
		l.nextSweep = now.Add(sweepEvery)
	}

	key := limitKey{operation, client}
	count := l.counts[key]
	if count == nil || !now.Before(count.resets) {
		count = &limitCount{resets: now.Add(limit.window)}
		l.counts[key] = count
	}
	count.hits++
	return max(limit.max-count.hits, 0), count.resets.Sub(now), count.hits <= limit.max
}

// rateLimiting returns the middleware that enforces rateLimits. It runs after
// authentication, so an anonymous request to a protected operation is a 401
// and not counted, and before validation, so an invalid request is counted.
// Both are the Node backend's order.
func (s *Server) rateLimiting(spec *openapi3.T) (func(http.Handler) http.Handler, error) {
	if err := checkRateLimits(spec, rateLimits); err != nil {
		return nil, err
	}
	if s.rateLimitingOff {
		return func(next http.Handler) http.Handler { return next }, nil
	}
	spec.Servers = nil
	router, err := gorillamux.NewRouter(spec)
	if err != nil {
		return nil, fmt.Errorf("building the rate limiting router: %w", err)
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			route, _, err := router.FindRoute(r)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			limit, ok := rateLimits[route.Operation.OperationID]
			if !ok {
				next.ServeHTTP(w, r)
				return
			}
			remaining, resetIn, allowed := s.limiter.hit(route.Operation.OperationID, clientKey(r, s.trustedProxyHops), limit)

			// The IETF draft-6 headers, as express-rate-limit's standardHeaders.
			resetSeconds := strconv.Itoa(int(math.Ceil(resetIn.Seconds())))
			w.Header().Set("RateLimit-Policy", fmt.Sprintf("%d;w=%d", limit.max, int(limit.window.Seconds())))
			w.Header().Set("RateLimit-Limit", strconv.Itoa(limit.max))
			w.Header().Set("RateLimit-Remaining", strconv.Itoa(remaining))
			w.Header().Set("RateLimit-Reset", resetSeconds)
			if !allowed {
				w.Header().Set("Retry-After", resetSeconds)
				writeJSON(w, http.StatusTooManyRequests, api.DetailedError{
					Error: limit.error, Message: limit.message, StatusCode: http.StatusTooManyRequests,
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}, nil
}

// checkRateLimits fails unless limits covers exactly the operations the spec
// documents a 429 for, so the spec and the server cannot drift apart.
func checkRateLimits(spec *openapi3.T, limits map[string]rateLimit) error {
	documented := operationsDocumenting429(spec)
	limited := slices.Sorted(maps.Keys(limits))
	if !slices.Equal(documented, limited) {
		return fmt.Errorf("habitcraft: rate limits are on %v, but the spec documents 429 on %v", limited, documented)
	}
	return nil
}

// operationsDocumenting429 returns the operations whose responses include
// a 429, sorted.
func operationsDocumenting429(spec *openapi3.T) []string {
	var ids []string
	for _, item := range spec.Paths.Map() {
		for _, operation := range item.Operations() {
			if operation.Responses.Status(http.StatusTooManyRequests) != nil {
				ids = append(ids, operation.OperationID)
			}
		}
	}
	slices.Sort(ids)
	return ids
}

// clientIP returns the address of the client that sent r, believing the last
// hops entries of X-Forwarded-For and nothing before them, as Express does
// with 'trust proxy' set to a hop count. The header is the caller's to
// write; each proxy only appends the address it was connected from, so only
// the entries the trusted proxies appended are true (AUTHENTICATION.md, "Rate
// limiting depends on a bounded proxy trust boundary").
func clientIP(r *http.Request, hops int) string {
	// Nearest first: the connection, then each forwarded entry backwards.
	addresses := []string{r.RemoteAddr}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		addresses[0] = host
	}
	if hops > 0 {
		var forwarded []string
		for _, value := range r.Header.Values("X-Forwarded-For") {
			for _, entry := range strings.Split(value, ",") {
				if entry = strings.TrimSpace(entry); entry != "" {
					forwarded = append(forwarded, entry)
				}
			}
		}
		slices.Reverse(forwarded)
		addresses = append(addresses, forwarded...)
	}
	client := addresses[min(hops, len(addresses)-1)]
	if addr, err := netip.ParseAddr(client); err == nil {
		return addr.Unmap().String()
	}
	return client
}

// clientKey is the client a rate limit counts r against: its address, or for
// IPv6 its /56 network.
func clientKey(r *http.Request, hops int) string {
	ip := clientIP(r, hops)
	addr, err := netip.ParseAddr(ip)
	if err != nil || !addr.Is6() {
		return ip
	}
	prefix, err := addr.Prefix(ipv6Prefix)
	if err != nil {
		return ip
	}
	return prefix.String()
}

var errNegativeHops = errors.New("habitcraft: Config.TrustedProxyHops must not be negative")
