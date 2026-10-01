package main

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/santiagoSaMi/full-stack-calculator/backend/internal/server"
)

func TestListenAddr(t *testing.T) {
	tests := []struct {
		name string
		port string
		want string
	}{
		{"defaults to 8080 when PORT is unset", "", ":8080"},
		{"uses PORT when set", "9000", ":9000"},
		{"accepts port 0 for an ephemeral port", "0", ":0"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			getenv := func(key string) string {
				if key != "PORT" {
					t.Errorf("read unexpected environment variable %q", key)
				}
				return tt.port
			}
			if got := listenAddr(getenv); got != tt.want {
				t.Errorf("listenAddr() = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestNewServerSetsTimeouts guards the timeouts that protect the server from
// slow or stalled clients; the zero value of each means "no limit".
func TestNewServerSetsTimeouts(t *testing.T) {
	srv := newServer(http.NotFoundHandler())

	timeouts := map[string]time.Duration{
		"ReadHeaderTimeout": srv.ReadHeaderTimeout,
		"ReadTimeout":       srv.ReadTimeout,
		"WriteTimeout":      srv.WriteTimeout,
		"IdleTimeout":       srv.IdleTimeout,
	}
	for name, timeout := range timeouts {
		if timeout <= 0 {
			t.Errorf("%s = %v, want a positive timeout", name, timeout)
		}
	}
}

// startServing runs serve on an ephemeral local port and returns its base
// URL, a function that stops it, and a channel with serve's return value.
func startServing(t *testing.T, handler http.Handler, timeout time.Duration) (baseURL string, stop context.CancelFunc, done <-chan error) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	result := make(chan error, 1)
	go func() { result <- serve(ctx, ln, handler, timeout) }()
	return "http://" + ln.Addr().String(), cancel, result
}

// waitFor returns serve's result, failing the test if it does not arrive.
func waitFor(t *testing.T, done <-chan error) error {
	t.Helper()
	select {
	case err := <-done:
		return err
	case <-time.After(5 * time.Second):
		t.Fatal("serve did not return")
		return nil
	}
}

func TestServeHandlesRequestsUntilStopped(t *testing.T) {
	baseURL, stop, done := startServing(t, server.NewHandler(), time.Second)

	res, err := http.Get(baseURL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}
	if got, want := string(body), "{\"status\":\"ok\"}\n"; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}

	stop()

	if err := waitFor(t, done); err != nil {
		t.Errorf("serve returned %v after a clean shutdown, want nil", err)
	}
	if _, err := http.Get(baseURL + "/health"); err == nil {
		t.Error("server still accepts connections after shutdown")
	}
}

func TestServeFinishesInFlightRequestsOnShutdown(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
		_, _ = io.WriteString(w, "finished")
	})
	baseURL, stop, done := startServing(t, handler, 5*time.Second)

	type response struct {
		body string
		err  error
	}
	got := make(chan response, 1)
	go func() {
		res, err := http.Get(baseURL)
		if err != nil {
			got <- response{err: err}
			return
		}
		defer res.Body.Close()
		body, err := io.ReadAll(res.Body)
		got <- response{body: string(body), err: err}
	}()

	<-started
	stop()

	// Shutdown must wait for the request rather than cut it off.
	select {
	case err := <-done:
		t.Fatalf("serve returned (%v) while a request was still in flight", err)
	case <-time.After(100 * time.Millisecond):
	}

	close(release)

	r := <-got
	if r.err != nil {
		t.Fatalf("in-flight request failed: %v", r.err)
	}
	if r.body != "finished" {
		t.Errorf("body = %q, want %q", r.body, "finished")
	}
	if err := waitFor(t, done); err != nil {
		t.Errorf("serve returned %v, want nil", err)
	}
}

func TestServeGivesUpOnRequestsThatOutliveTheShutdownTimeout(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	handler := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		close(started)
		<-release
	})
	baseURL, stop, done := startServing(t, handler, 50*time.Millisecond)

	go func() {
		if res, err := http.Get(baseURL); err == nil {
			res.Body.Close()
		}
	}()

	<-started
	stop()

	err := waitFor(t, done)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("serve returned %v, want an error wrapping %v", err, context.DeadlineExceeded)
	}
}

func TestServeReturnsAnErrorIfItCannotServe(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	ln.Close() // serving on a closed listener fails immediately

	done := make(chan error, 1)
	go func() { done <- serve(context.Background(), ln, http.NotFoundHandler(), time.Second) }()

	if err := waitFor(t, done); err == nil {
		t.Error("serve returned nil for a closed listener, want an error")
	}
}
