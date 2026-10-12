// Command habitcraft runs the HabitCraft server on its own.
//
// Configuration is from the environment:
//
//	DATABASE_URL  required; a database migrated with db/migrations (dbmate)
//	PORT          optional; default 8080
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

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
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// pgxpool connects lazily, so the server starts, and /health reports
	// the database as disconnected, even when the database is not up yet.
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("configuring the database pool: %w", err)
	}
	defer db.Close()

	server, err := habitcraft.New(habitcraft.Config{DB: db})
	if err != nil {
		return err
	}
	handler, err := server.Handler()
	if err != nil {
		return err
	}

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
