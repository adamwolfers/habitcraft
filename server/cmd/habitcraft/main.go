// Command habitcraft runs the HabitCraft server on its own, with the web app
// (web/) embedded beside the API when it was built first; see webapp.go.
//
// Configuration is from the environment:
//
//	DATABASE_URL      required; a database migrated with db/migrations (dbmate)
//	JWT_SECRET        required; at least 32 bytes, the Node backend's while both run
//	PORT              optional; default 8080
//	INSECURE_COOKIES  optional; "true" for local development over plain HTTP
//	                  (auth cookies without Secure, SameSite=Lax). Never in production.
//	TRUSTED_PROXY_HOPS optional; default 1, the proxies in front of the server
//	                  that append to X-Forwarded-For. Production is Kamal on one
//	                  VPS: kamal-proxy, and nothing else, so 1. Use 0 with nothing
//	                  in front. The rate limits depend on it being exact.
//	SKIP_RATE_LIMIT   optional; "true" turns the rate limits off, for test
//	                  suites that make many requests from one address, as on
//	                  the Node backend. Never in production.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net"
	"net/http"
	"os"
	"os/signal"
	"slices"
	"strconv"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adamwolfers/habitcraft/server/api"
	"github.com/adamwolfers/habitcraft/server/habitcraft"
)

// shutdownGrace is how long in-flight requests get to finish on SIGTERM.
const shutdownGrace = 10 * time.Second

func main() {
	if err := run(); err != nil {
		slog.Error("habitcraft stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return errors.New("DATABASE_URL is not set")
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return errors.New("JWT_SECRET is not set")
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	insecureCookies, err := boolFromEnv("INSECURE_COOKIES")
	if err != nil {
		return err
	}
	skipRateLimit, err := boolFromEnv("SKIP_RATE_LIMIT")
	if err != nil {
		return err
	}
	trustedProxyHops, err := trustedProxyHopsFromEnv(os.Getenv("TRUSTED_PROXY_HOPS"))
	if err != nil {
		return err
	}

	// pgxpool connects lazily, so the server starts, and /health reports
	// the database as disconnected, even when the database is not up yet.
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("configuring the database pool: %w", err)
	}
	defer db.Close()

	server, err := habitcraft.New(habitcraft.Config{
		DB:                  db,
		JWTSecret:           []byte(jwtSecret),
		InsecureCookies:     insecureCookies,
		TrustedProxyHops:    trustedProxyHops,
		DisableRateLimiting: skipRateLimit,
	})
	if err != nil {
		return err
	}
	handler, err := server.Handler()
	if err != nil {
		return err
	}
	spec, err := api.GetSwagger()
	if err != nil {
		return fmt.Errorf("loading the embedded spec: %w", err)
	}
	webApp, err := webAppFiles()
	if err != nil {
		return err
	}
	handler = withWebApp(handler, webApp, slices.Collect(maps.Keys(spec.Paths.Map())))

	httpServer := &http.Server{
		Addr:              net.JoinHostPort("", port),
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		slog.Info("habitcraft listening", "addr", httpServer.Addr)
		serveErr <- httpServer.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}

	slog.Info("habitcraft shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancel()
	return httpServer.Shutdown(shutdownCtx)
}

// defaultTrustedProxyHops is production's topology: kamal-proxy terminates
// TLS on the VPS and is the only proxy in front of the server
// (habitcraft-vxln.9). It appends the connecting address to X-Forwarded-For,
// making the last entry the only one a client cannot forge.
const defaultTrustedProxyHops = 1

// trustedProxyHopsFromEnv parses TRUSTED_PROXY_HOPS. An unusable value is an
// error, never a fallback: a wrong count either lets a caller choose their own
// address and walk past every rate limit, or puts every client in one bucket.
func trustedProxyHopsFromEnv(value string) (int, error) {
	if value == "" {
		return defaultTrustedProxyHops, nil
	}
	hops, err := strconv.Atoi(value)
	if err != nil || hops < 0 {
		return 0, fmt.Errorf("TRUSTED_PROXY_HOPS=%q is not a non-negative integer: it is the number of proxies in front of the server (kamal-proxy alone: 1)", value)
	}
	return hops, nil
}

// boolFromEnv parses an optional true/false setting; unset is false.
func boolFromEnv(name string) (bool, error) {
	value := os.Getenv(name)
	if value == "" {
		return false, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s=%q is not true or false", name, value)
	}
	return parsed, nil
}
