// Command server runs the calculator HTTP API.
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/santiagoSaMi/full-stack-calculator/backend/internal/server"
)

const (
	defaultPort = "8080"

	// shutdownTimeout is how long in-flight requests get to finish once the
	// server is asked to stop.
	shutdownTimeout = 10 * time.Second
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	addr := listenAddr(os.Getenv)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}

	log.Printf("server listening on %s", addr)
	if err := serve(ctx, ln, server.NewHandler(), shutdownTimeout); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// listenAddr returns the address to listen on. The port comes from the PORT
// environment variable, read through getenv, and defaults to defaultPort.
func listenAddr(getenv func(string) string) string {
	port := getenv("PORT")
	if port == "" {
		port = defaultPort
	}
	return ":" + port
}

// newServer returns an HTTP server for handler with timeouts that keep slow
// or stalled clients from holding connections open indefinitely.
func newServer(handler http.Handler) *http.Server {
	return &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}

// serve handles requests on ln until ctx is cancelled, then shuts down
// gracefully: it stops accepting connections and waits up to timeout for
// in-flight requests to finish. It returns nil after a clean shutdown.
func serve(ctx context.Context, ln net.Listener, handler http.Handler, timeout time.Duration) error {
	srv := newServer(handler)

	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(ln) }()

	select {
	case err := <-serveErr:
		// The server stopped on its own, before being asked to.
		return err
	case <-ctx.Done():
	}

	log.Println("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	return nil
}
