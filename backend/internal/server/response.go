package server

import (
	"encoding/json"
	"log"
	"net/http"
)

// errorResponse is the JSON body returned for every error. Error describes
// the problem for a developer; Code identifies it for a program, and stays
// the same if the wording of Error changes.
type errorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

// Values of the "code" field. Clients branch on these, so they are part of
// the API contract: add new ones freely, but do not rename existing ones.
const (
	codeMethodNotAllowed     = "method_not_allowed"
	codeNotFound             = "not_found"
	codeUnsupportedMediaType = "unsupported_media_type"
	codeBodyTooLarge         = "body_too_large"
	codeInvalidJSON          = "invalid_json"
	codeUnknownField         = "unknown_field"
	codeDuplicateField       = "duplicate_field"
	codeMissingField         = "missing_field"
	codeInvalidFieldType     = "invalid_field_type"
	codeFieldOutOfRange      = "field_out_of_range"
	codeFieldNotAllowed      = "field_not_allowed"
	codeUnsupportedOperation = "unsupported_operation"
	codeDivisionByZero       = "division_by_zero"
	codeNotARealNumber       = "not_a_real_number"
	codeNegativeSquareRoot   = "negative_square_root"
	codeResultOutOfRange     = "result_out_of_range"
	codeInternalError        = "internal_error"
)

// writeJSON writes v as a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("write response: %v", err)
	}
}

// writeError writes a JSON error response with the given status and code.
func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, errorResponse{Error: msg, Code: code})
}
