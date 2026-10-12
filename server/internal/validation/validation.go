// Package validation rejects a request that does not match openapi.yaml before
// any handler sees it, so the spec's request schemas are enforced rather than
// merely documented (habitcraft-sb0).
//
// The rejection is a 400 in whichever error shape the operation's own 400
// response documents. The spec has three of them, inherited from the Node
// backend's routes, and the acceptance suite checks every response body against
// the spec, so a single generic shape would fail it:
//
//	ValidationErrors  auth and user routes   {"errors": [{"msg", "path", ...}]}
//	DetailedError     habit routes           {"error", "message", "statusCode"}
//	Error             completion routes      {"error"}
package validation

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/mail"
	"path"
	"regexp"
	"strings"
	"sync"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"
)

// Middleware validates each request against spec. A request that matches no
// operation passes through untouched, so the router answers it as it would
// any unknown path.
//
// spec is modified: its servers are dropped, because the router matches them
// by host and the spec lists a localhost and an example production URL, which
// would make every request on any other host look like an unknown path.
func Middleware(spec *openapi3.T) (func(http.Handler) http.Handler, error) {
	formatsOnce.Do(defineFormats)
	spec.Servers = nil
	router, err := gorillamux.NewRouter(spec)
	if err != nil {
		return nil, fmt.Errorf("building the request router: %w", err)
	}

	options := &openapi3filter.Options{
		// Report every failed field, not just the first, as express-validator does.
		MultiError: true,
		// Authentication belongs to the handlers: the access token can arrive as
		// a cookie, which the spec's bearerAuth scheme does not describe.
		AuthenticationFunc: openapi3filter.NoopAuthenticationFunc,
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			route, params, err := router.FindRoute(r)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			input := &openapi3filter.RequestValidationInput{
				Request:    r,
				PathParams: params,
				Route:      route,
				Options:    options,
			}
			// ValidateRequest puts back the body it reads, so the handler can
			// still decode it.
			if err := openapi3filter.ValidateRequest(r.Context(), input); err != nil {
				reject(w, route, problemsIn(err))
				return
			}
			next.ServeHTTP(w, r)
		})
	}, nil
}

var formatsOnce sync.Once

// anyUUID is every UUID Postgres's uuid type accepts, whatever its version.
var anyUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// defineFormats registers the string formats the spec uses that kin-openapi
// does not check by default. Without them "format: email" and "format: uuid"
// are silently ignored. The registry is global to kin-openapi, so this runs
// once per process.
func defineFormats() {
	openapi3.DefineStringFormatCallback("email", func(value string) error {
		// net/mail, not a regex: it has no cap on the local part, so an address
		// at the spec's maxLength is accepted (unlike Node's isEmail,
		// habitcraft-0roi). Address must be all of value, with no display name.
		address, err := mail.ParseAddress(value)
		if err != nil || address.Address != value {
			return errors.New("not a valid email address")
		}
		return nil
	})
	openapi3.DefineStringFormatCallback("uuid", func(value string) error {
		if !anyUUID.MatchString(value) {
			return errors.New("not a valid UUID")
		}
		return nil
	})
}

// A problem is one reason a request was refused.
type problem struct {
	location string // "body", "query" or "params"; empty when unknown
	field    string // dotted path to the offending value; empty for the whole input
	message  string
}

func (p problem) String() string {
	if p.field == "" {
		return p.message
	}
	return p.field + ": " + p.message
}

// problemsIn flattens kin-openapi's nested errors into one problem per field.
//
// It switches on the concrete types rather than using errors.As, which would
// unwrap straight through a RequestError to the errors inside it and lose
// where in the request they were found.
func problemsIn(err error) []problem {
	switch err := err.(type) {
	case openapi3.MultiError:
		var problems []problem
		for _, inner := range err {
			problems = append(problems, problemsIn(inner)...)
		}
		return problems
	case *openapi3filter.RequestError:
		location := "body"
		if err.Parameter != nil {
			location = locationOf(err.Parameter.In)
		}
		if err.Err == nil {
			return []problem{{location: location, message: err.Reason}}
		}
		problems := problemsIn(err.Err)
		for i := range problems {
			problems[i].location = location
			if err.Parameter != nil && problems[i].field == "" {
				problems[i].field = err.Parameter.Name
			}
		}
		return problems
	case *openapi3.SchemaError:
		// A missing required property is already named in the pointer.
		return []problem{{field: strings.Join(err.JSONPointer(), "."), message: err.Reason}}
	case *openapi3filter.ParseError:
		return []problem{{message: err.Error()}}
	}
	return []problem{{message: err.Error()}}
}

// locationOf maps an OpenAPI parameter location onto express-validator's names.
func locationOf(in string) string {
	switch in {
	case openapi3.ParameterInPath:
		return "params"
	default:
		return in
	}
}

// reject writes the 400 in the shape the operation documents for it.
func reject(w http.ResponseWriter, route *routers.Route, problems []problem) {
	if len(problems) == 0 {
		problems = []problem{{message: "invalid request"}}
	}

	var body any
	switch errorSchemaOf(route.Operation) {
	case "ValidationErrors":
		errs := make([]map[string]string, 0, len(problems))
		for _, p := range problems {
			// The rejected value is left out on purpose: it may be a password.
			entry := map[string]string{"type": "field", "msg": p.message}
			if p.field != "" {
				entry["path"] = p.field
			}
			if p.location != "" {
				entry["location"] = p.location
			}
			errs = append(errs, entry)
		}
		body = map[string]any{"errors": errs}
	case "DetailedError":
		body = map[string]any{
			"error":      "Validation error",
			"message":    joined(problems),
			"statusCode": http.StatusBadRequest,
		}
	default:
		// "Error", and the operations that document no 400 at all. Those take
		// no body and only a few parameters, so a 400 there means the spec is
		// missing a response it should list.
		body = map[string]string{"error": joined(problems)}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("writing a validation response", "err", err)
	}
}

func joined(problems []problem) string {
	messages := make([]string, len(problems))
	for i, p := range problems {
		messages[i] = p.String()
	}
	return strings.Join(messages, "; ")
}

// errorSchemaOf names the component schema of the operation's documented 400
// body, such as "ValidationErrors", or "" when it documents none.
func errorSchemaOf(operation *openapi3.Operation) string {
	response := operation.Responses.Status(http.StatusBadRequest)
	if response == nil || response.Value == nil {
		return ""
	}
	media := response.Value.Content.Get("application/json")
	if media == nil || media.Schema == nil {
		return ""
	}
	return path.Base(media.Schema.Ref)
}
