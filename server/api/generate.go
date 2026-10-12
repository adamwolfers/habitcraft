// Package api is the HTTP interface generated from shared/api-spec/openapi.yaml:
// request and response types, a strict server interface whose methods can only
// return the responses the spec documents, and the spec itself, embedded for
// request validation. Never hand-edit api.gen.go; change the spec and run
// `npm run api:codegen` from the repo root.
package api

//go:generate go tool oapi-codegen -config oapi-codegen.yaml -o api.gen.go ../../shared/api-spec/openapi.yaml
