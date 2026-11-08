package habitcraft

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

// oversized is a JSON body one byte over the cap: a valid login, padded.
func oversized() string {
	prefix := `{"email":"alice@example.com","password":"`
	suffix := `"}`
	return prefix + strings.Repeat("x", maxBodyBytes+1-len(prefix)-len(suffix)) + suffix
}

func TestABodyOverTheCapIs413(t *testing.T) {
	a := newApp(t)

	w := a.do(http.MethodPost, "/api/v1/auth/login", oversized())

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413: %s", w.Code, w.Body)
	}
	if got := errorOf(t, w); got != "Request body too large" {
		t.Errorf("error = %q", got)
	}
}

func TestABodyOverTheCapIs413WhateverItsDeclaredLength(t *testing.T) {
	a := newApp(t)

	// A chunked body declares no length, so only reading it can tell.
	w := a.do(http.MethodPost, "/api/v1/auth/register", oversized(), func(r *http.Request) {
		r.ContentLength = -1
		r.Body = io.NopCloser(strings.NewReader(oversized()))
	})

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", w.Code)
	}
}

func TestADeclaredLengthOverTheCapIsRefusedUnread(t *testing.T) {
	a := newApp(t)
	body := &countingReader{Reader: strings.NewReader("{}")}

	w := a.do(http.MethodPost, "/api/v1/auth/login", "{}", func(r *http.Request) {
		r.ContentLength = maxBodyBytes + 1
		r.Body = io.NopCloser(body)
	})

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", w.Code)
	}
	if body.read != 0 {
		t.Errorf("read %d bytes of a body declared too large", body.read)
	}
}

func TestTheCapComesBeforeAuthentication(t *testing.T) {
	// As on the Node backend, whose JSON parser runs before any route.
	a := newApp(t)

	w := a.do(http.MethodPut, "/api/v1/users/me", oversized())

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", w.Code)
	}
}

func TestABodyAtTheCapIsRead(t *testing.T) {
	a := newApp(t)
	body := oversized()[1:] // exactly maxBodyBytes, and no longer JSON

	w := a.do(http.MethodPost, "/api/v1/auth/login", body)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want validation's 400: %s", w.Code, w.Body)
	}
}

func TestTheCapIsNodesDefault(t *testing.T) {
	// Express's json() parser caps a body at 100kb, which is 100 KiB.
	if maxBodyBytes != 100*1024 {
		t.Errorf("maxBodyBytes = %d, want Node's 102400", maxBodyBytes)
	}
}

type countingReader struct {
	io.Reader
	read int
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.Reader.Read(p)
	c.read += n
	return n, err
}
