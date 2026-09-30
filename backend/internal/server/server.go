// Package server is the HTTP layer of the calculator service. It owns
// routing, request decoding, validation and response encoding, and delegates
// all arithmetic to the calculator package.
package server

import (
	"net/http"
)

// NewHandler returns the root HTTP handler with all routes registered.
func NewHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /api/v1/calculate", handleCalculate)
	// Method-less pattern: matches every other method on the same path, since
	// the POST pattern above is more specific.
	mux.HandleFunc("/api/v1/calculate", methodNotAllowed(http.MethodPost))
	return mux
}

type healthResponse struct {
	Status string `json:"status"`
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{Status: "ok"})
}

// methodNotAllowed returns a handler that responds with a JSON 405 error and
// an Allow header listing the permitted methods.
func methodNotAllowed(allowed string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Allow", allowed)
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}
