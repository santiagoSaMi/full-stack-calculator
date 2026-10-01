package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"mime"
	"net/http"

	"github.com/santiagoSaMi/full-stack-calculator/backend/internal/calculator"
)

// maxRequestBytes caps the size of a calculate request body.
const maxRequestBytes = 1 << 10 // 1 KiB

// calculateRequest is a validated request to POST /api/v1/calculate.
type calculateRequest struct {
	Operation string
	A, B      float64
}

// calculateResponse is the JSON body returned on success.
type calculateResponse struct {
	Result float64 `json:"result"`
}

// operations maps each supported operation name to its calculator function.
var operations = map[string]func(a, b float64) (float64, error){
	"add":      infallible(calculator.Add),
	"subtract": infallible(calculator.Subtract),
	"multiply": infallible(calculator.Multiply),
	"divide":   calculator.Divide,
	"power":    calculator.Power,
}

// infallible adapts an operation that cannot fail to the common signature.
func infallible(fn func(a, b float64) float64) func(a, b float64) (float64, error) {
	return func(a, b float64) (float64, error) {
		return fn(a, b), nil
	}
}

func handleCalculate(w http.ResponseWriter, r *http.Request) {
	if !isJSON(r.Header.Get("Content-Type")) {
		writeError(w, http.StatusUnsupportedMediaType, "Content-Type must be application/json")
		return
	}

	req, apiErr := decodeCalculateRequest(http.MaxBytesReader(w, r.Body, maxRequestBytes))
	if apiErr != nil {
		writeError(w, apiErr.status, apiErr.message)
		return
	}

	result, err := operations[req.Operation](req.A, req.B)
	if errors.Is(err, calculator.ErrDivisionByZero) || errors.Is(err, calculator.ErrNotRealNumber) {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if err != nil {
		log.Printf("calculate %s: %v", req.Operation, err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if math.IsInf(result, 0) || math.IsNaN(result) {
		writeError(w, http.StatusUnprocessableEntity, "result is out of range")
		return
	}

	writeJSON(w, http.StatusOK, calculateResponse{Result: result})
}

// apiError is a client-facing error with the HTTP status to respond with.
type apiError struct {
	status  int
	message string
}

func badRequest(format string, args ...any) *apiError {
	return &apiError{status: http.StatusBadRequest, message: fmt.Sprintf(format, args...)}
}

// allowedFields is the exact, case-sensitive set of accepted request fields.
var allowedFields = map[string]bool{"operation": true, "a": true, "b": true}

// decodeCalculateRequest reads and validates a calculate request body.
// Checks run in a fixed order and the first failure is returned:
//
//  1. body size and JSON syntax (413, 400)
//  2. body is a single JSON object (400)
//  3. no unknown or duplicate fields, matched case-sensitively (400)
//  4. operation is present, a string, and supported (400)
//  5. a, then b, are present, numbers, and within float64 range (400)
func decodeCalculateRequest(body io.Reader) (calculateRequest, *apiError) {
	fields, apiErr := readObject(body)
	if apiErr != nil {
		return calculateRequest{}, apiErr
	}

	op, apiErr := operationField(fields)
	if apiErr != nil {
		return calculateRequest{}, apiErr
	}
	a, apiErr := numberField(fields, "a")
	if apiErr != nil {
		return calculateRequest{}, apiErr
	}
	b, apiErr := numberField(fields, "b")
	if apiErr != nil {
		return calculateRequest{}, apiErr
	}

	return calculateRequest{Operation: op, A: a, B: b}, nil
}

// readObject parses body as a single, flat JSON object and returns its raw
// field values. It reads the whole body before reporting field problems, so
// a syntax or size error always takes precedence over an unknown or
// duplicate field.
func readObject(body io.Reader) (map[string]json.RawMessage, *apiError) {
	dec := json.NewDecoder(body)

	tok, err := dec.Token()
	if err != nil {
		if errors.Is(err, io.EOF) {
			return nil, badRequest("request body must not be empty")
		}
		return nil, syntaxError(err)
	}
	if tok != json.Delim('{') {
		return nil, badRequest("request body must be a valid JSON object")
	}

	fields := make(map[string]json.RawMessage)
	var fieldErr *apiError
	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return nil, syntaxError(err)
		}
		key, _ := tok.(string) // object keys are always strings
		var value json.RawMessage
		if err := dec.Decode(&value); err != nil {
			return nil, syntaxError(err)
		}

		// Keep only the first field problem, in document order.
		if _, seen := fields[key]; fieldErr == nil && !allowedFields[key] {
			fieldErr = badRequest("request body contains unknown field %q", key)
		} else if fieldErr == nil && seen {
			fieldErr = badRequest("request body contains duplicate field %q", key)
		}
		fields[key] = value
	}
	if _, err := dec.Token(); err != nil { // closing '}'
		return nil, syntaxError(err)
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			return nil, syntaxError(err)
		}
		return nil, badRequest("request body must contain a single JSON object")
	}
	if fieldErr != nil {
		return nil, fieldErr
	}
	return fields, nil
}

// syntaxError maps an error from reading the body to a client-facing error.
func syntaxError(err error) *apiError {
	var maxBytesErr *http.MaxBytesError
	if errors.As(err, &maxBytesErr) {
		return &apiError{
			status:  http.StatusRequestEntityTooLarge,
			message: fmt.Sprintf("request body must not exceed %d bytes", maxRequestBytes),
		}
	}
	return badRequest("request body contains malformed JSON")
}

// isNull reports whether a field is absent or explicitly null.
func isNull(raw json.RawMessage) bool {
	return raw == nil || string(raw) == "null"
}

func operationField(fields map[string]json.RawMessage) (string, *apiError) {
	raw := fields["operation"]
	if isNull(raw) {
		return "", badRequest(`field "operation" is required`)
	}
	var op string
	if err := json.Unmarshal(raw, &op); err != nil {
		return "", badRequest(`field "operation" must be a string`)
	}
	if op == "" {
		return "", badRequest(`field "operation" is required`)
	}
	if _, ok := operations[op]; !ok {
		return "", badRequest("unsupported operation %q: must be one of add, subtract, multiply, divide, power", op)
	}
	return op, nil
}

func numberField(fields map[string]json.RawMessage, name string) (float64, *apiError) {
	raw := fields[name]
	if isNull(raw) {
		return 0, badRequest("field %q is required", name)
	}
	var n float64
	if err := json.Unmarshal(raw, &n); err != nil {
		// A JSON number starts with '-' or a digit; if it still failed to
		// decode, it does not fit in a float64.
		if c := raw[0]; c == '-' || (c >= '0' && c <= '9') {
			return 0, badRequest("field %q is out of range", name)
		}
		return 0, badRequest("field %q must be a number", name)
	}
	return n, nil
}

// isJSON reports whether a Content-Type header value is application/json,
// ignoring parameters such as charset.
func isJSON(contentType string) bool {
	mediaType, _, err := mime.ParseMediaType(contentType)
	return err == nil && mediaType == "application/json"
}
