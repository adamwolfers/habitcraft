package validation

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"

	"github.com/adamwolfers/habitcraft/server/api"
)

const habitID = "7e0b6c1e-4d1a-4a7e-9a55-0c7d6f1b2a33"

// passed is the status the stand-in handler answers with, so a test can tell
// a request that got through from one the middleware answered.
const passed = http.StatusTeapot

func loadSpec(t *testing.T) *openapi3.T {
	t.Helper()
	spec, err := api.GetSwagger()
	if err != nil {
		t.Fatal(err)
	}
	return spec
}

func newHandler(t *testing.T) http.Handler {
	t.Helper()
	middleware, err := Middleware(loadSpec(t))
	if err != nil {
		t.Fatal(err)
	}
	return middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Proves the body is still readable after validation consumed it.
		body, _ := io.ReadAll(r.Body)
		w.WriteHeader(passed)
		_, _ = w.Write(body)
	}))
}

func send(t *testing.T, h http.Handler, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, target, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func decode[T any](t *testing.T, w *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatalf("decoding %q: %v", w.Body.String(), err)
	}
	return v
}

func TestValidRequestsReachTheHandlerWithTheirBody(t *testing.T) {
	h := newHandler(t)
	body := `{"email":"alice@example.com","password":"long enough","name":"Alice"}`

	w := send(t, h, http.MethodPost, "/api/v1/auth/register", body)

	if w.Code != passed {
		t.Fatalf("status = %d, want it passed through; body %s", w.Code, w.Body)
	}
	if w.Body.String() != body {
		t.Errorf("handler read %q, want the original body", w.Body)
	}
}

func TestRequestsForNoOperationPassThrough(t *testing.T) {
	h := newHandler(t)
	for _, target := range []string{"/nope", "/api/v1/habits/" + habitID + "/nope"} {
		if w := send(t, h, http.MethodGet, target, ""); w.Code != passed {
			t.Errorf("GET %s: status = %d, want it passed through", target, w.Code)
		}
	}
}

func TestAuthAndUserRoutesListEveryFailedField(t *testing.T) {
	h := newHandler(t)

	w := send(t, h, http.MethodPost, "/api/v1/auth/register", `{"email":"alice.example.com","password":"short"}`)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	got := decode[api.ValidationErrors](t, w)
	var paths []string
	for _, e := range got.Errors {
		if e.Location == nil || *e.Location != "body" {
			t.Errorf("error %+v: want location body", e)
		}
		if e.Path != nil {
			paths = append(paths, *e.Path)
		}
	}
	slices.Sort(paths)
	if want := []string{"email", "name", "password"}; !slices.Equal(paths, want) {
		t.Errorf("failed fields = %v, want %v", paths, want)
	}
}

func TestHabitRoutesAnswerWithADetailedError(t *testing.T) {
	h := newHandler(t)

	w := send(t, h, http.MethodPut, "/api/v1/habits/not-a-uuid", `{"name":"Run"}`)

	got := decode[api.DetailedError](t, w)
	if w.Code != http.StatusBadRequest || got.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, body statusCode = %d, want 400 for both", w.Code, got.StatusCode)
	}
	if !strings.HasPrefix(got.Message, "habitId: ") {
		t.Errorf("message = %q, want it to name habitId", got.Message)
	}
}

func TestCompletionRoutesAnswerWithABareError(t *testing.T) {
	h := newHandler(t)

	w := send(t, h, http.MethodPost, "/api/v1/habits/"+habitID+"/completions", `{"date":"2026-02-30x"}`)

	got := decode[api.Error](t, w)
	if w.Code != http.StatusBadRequest || !strings.HasPrefix(got.Error, "date: ") {
		t.Fatalf("got %d %+v, want a 400 naming date", w.Code, got)
	}
}

func TestEmailFormat(t *testing.T) {
	h := newHandler(t)
	longest := strings.Repeat("a", 64) + "@" + strings.Repeat("b", 63) + ".example.com"

	for _, tc := range []struct {
		email string
		valid bool
	}{
		{"alice@example.com", true},
		{"ALICE@EXAMPLE.COM", true},
		// A local part over 64 characters, which Node's isEmail refuses
		// (habitcraft-0roi). The spec's maxLength is the only length rule.
		{strings.Repeat("a", 80) + "@example.com", true},
		{longest, true},
		{"alice.example.com", false},
		{"Alice <alice@example.com>", false},
		{"alice@", false},
		{"", false},
	} {
		body, _ := json.Marshal(map[string]string{"email": tc.email, "password": "long enough", "name": "A"})
		w := send(t, h, http.MethodPost, "/api/v1/auth/register", string(body))
		if got := w.Code == passed; got != tc.valid {
			t.Errorf("%q: accepted = %v, want %v (%s)", tc.email, got, tc.valid, w.Body)
		}
	}
}

func TestUUIDFormatAcceptsAnyVersion(t *testing.T) {
	h := newHandler(t)
	for _, id := range []string{habitID, "00000000-0000-0000-0000-000000000000", "11111111-1111-1111-1111-111111111111"} {
		if w := send(t, h, http.MethodDelete, "/api/v1/habits/"+id, ""); w.Code != passed {
			t.Errorf("%s: status = %d, want it accepted", id, w.Code)
		}
	}
}

// hasInputs reports whether validation can refuse the operation at all. Some
// operations document a 400 a handler raises itself, such as refreshToken's
// missing cookie, and take nothing to validate.
func hasInputs(operation *openapi3.Operation) bool {
	return operation.RequestBody != nil || len(operation.Parameters) > 0
}

// Every operation with inputs that documents a 400 is sent a request that cannot be valid,
// and the answer is checked against the spec: the status and the body shape
// must both be ones that operation documents. This is what keeps the three
// error shapes in reject() matched to the operations that use them.
func TestEveryDocumented400MatchesTheSpec(t *testing.T) {
	spec := loadSpec(t)
	h := newHandler(t)
	router := newSpecRouter(t)

	checked := 0
	for path, item := range spec.Paths.Map() {
		for method, operation := range item.Operations() {
			if operation.Responses.Status(http.StatusBadRequest) == nil || !hasInputs(operation) {
				continue
			}
			target, body := invalidRequest(path, operation)
			t.Run(operation.OperationID, func(t *testing.T) {
				w := send(t, h, method, target, body)
				if w.Code != http.StatusBadRequest {
					t.Fatalf("%s %s: status = %d, want 400", method, target, w.Code)
				}
				assertDocumented(t, router, method, target, body, w)
			})
			checked++
		}
	}
	if checked < 10 {
		t.Fatalf("checked %d operations; the walk over the spec is broken", checked)
	}
}

// Operations that can be refused by validation but whose spec documents no 400.
// Each answers with the bare Error shape, which the acceptance suite would
// report as an undocumented status. Remove an entry when the spec documents
// its 400 (habitcraft-vxln.3.1). oapi-codegen capitalises the operationIds in
// the spec it embeds.
var undocumented400 = []string{"ListCompletions", "ListHabits"}

func TestOnlyKnownOperationsLackADocumented400(t *testing.T) {
	spec := loadSpec(t)
	var missing []string
	for _, item := range spec.Paths.Map() {
		for _, operation := range item.Operations() {
			if operation.Responses.Status(http.StatusBadRequest) != nil {
				continue
			}
			if hasInputs(operation) {
				missing = append(missing, operation.OperationID)
			}
		}
	}
	slices.Sort(missing)
	if !slices.Equal(missing, undocumented400) {
		t.Errorf("operations with inputs but no documented 400 = %v, want %v", missing, undocumented400)
	}
}

var pathParam = regexp.MustCompile(`\{[^}]+\}`)

// invalidRequest builds a request no operation accepts: every path parameter
// fails its format, and a JSON array stands where each body wants an object.
func invalidRequest(path string, operation *openapi3.Operation) (target, body string) {
	target = pathParam.ReplaceAllString(path, "not-valid")
	if operation.RequestBody != nil {
		body = "[]"
	}
	return target, body
}

func newSpecRouter(t *testing.T) routers.Router {
	t.Helper()
	spec := loadSpec(t)
	spec.Servers = nil
	router, err := gorillamux.NewRouter(spec)
	if err != nil {
		t.Fatal(err)
	}
	return router
}

func assertDocumented(t *testing.T, router routers.Router, method, target, body string, w *httptest.ResponseRecorder) {
	t.Helper()
	r := httptest.NewRequest(method, target, strings.NewReader(body))
	route, params, err := router.FindRoute(r)
	if err != nil {
		t.Fatalf("no route for %s %s: %v", method, target, err)
	}
	err = openapi3filter.ValidateResponse(context.Background(), &openapi3filter.ResponseValidationInput{
		RequestValidationInput: &openapi3filter.RequestValidationInput{Request: r, PathParams: params, Route: route},
		Status:                 w.Code,
		Header:                 w.Header(),
		Body:                   io.NopCloser(bytes.NewReader(w.Body.Bytes())),
	})
	if err != nil {
		t.Errorf("response %d %s does not match the spec: %v", w.Code, w.Body, err)
	}
}
