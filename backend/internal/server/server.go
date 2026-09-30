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
	return mux
}

type healthResponse struct {
	Status string `json:"status"`
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{Status: "ok"})
}
