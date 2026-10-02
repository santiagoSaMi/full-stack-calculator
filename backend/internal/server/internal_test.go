package server

import (
	"bytes"
	"errors"
	"log"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// These tests reach failure paths that no request can trigger through the
// public API, so they live inside the package.

// captureLog redirects the standard logger for the duration of the test.
func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	original := log.Writer()
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(original) })
	return &buf
}

// TestCalculateHidesUnexpectedErrors checks that an error the handler does
// not recognise becomes a generic 500: the client must not see internal
// details, and the details must reach the log.
func TestCalculateHidesUnexpectedErrors(t *testing.T) {
	const secret = "pq: password authentication failed for user admin"
	operations["explode"] = operation{apply: func(_, _ float64) (float64, error) {
		return 0, errors.New(secret)
	}}
	t.Cleanup(func() { delete(operations, "explode") })
	logged := captureLog(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(`{"operation":"explode","a":1,"b":2}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	NewHandler().ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want %q", got, "application/json")
	}
	if got, want := rec.Body.String(), "{\"error\":\"internal server error\",\"code\":\"internal_error\"}\n"; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
	if strings.Contains(rec.Body.String(), "password") {
		t.Error("response leaks the internal error")
	}
	if !strings.Contains(logged.String(), secret) {
		t.Errorf("log = %q, want it to contain the internal error", logged.String())
	}
}

// TestWriteJSONLogsEncodingFailures checks that a value JSON cannot represent
// is logged rather than causing a panic or a silent failure.
func TestWriteJSONLogsEncodingFailures(t *testing.T) {
	logged := captureLog(t)
	rec := httptest.NewRecorder()

	writeJSON(rec, http.StatusOK, calculateResponse{Result: math.Inf(1)})

	if !strings.Contains(logged.String(), "write response") {
		t.Errorf("log = %q, want it to report the failed write", logged.String())
	}
	if strings.Contains(rec.Body.String(), "Inf") {
		t.Errorf("body = %q, want no invalid JSON to be written", rec.Body.String())
	}
}
