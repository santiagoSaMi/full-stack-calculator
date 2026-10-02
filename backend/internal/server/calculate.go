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
// B is zero for operations that take a single operand.
type calculateRequest struct {
	Operation string
	A, B      float64
}

// calculateResponse is the JSON body returned on success.
type calculateResponse struct {
	Result float64 `json:"result"`
}

// operation describes a supported operation: how many operands it takes and
// the calculator function that performs it.
type operation struct {
	// unary is true for operations that take only operand a.
	unary bool
	apply func(a, b float64) (float64, error)
}

// operations maps each supported operation name to its definition.
var operations = map[string]operation{
	"add":      {apply: infallible(calculator.Add)},
	"subtract": {apply: infallible(calculator.Subtract)},
	"multiply": {apply: infallible(calculator.Multiply)},
	"divide":   {apply: calculator.Divide},
	"power":    {apply: calculator.Power},
	"sqrt":     {unary: true, apply: unary(calculator.Sqrt)},
	"percent":  {unary: true, apply: unary(infallibleUnary(calculator.Percent))},
}

// supportedOperations lists the operation names in the order shown to clients.
const supportedOperations = "add, subtract, multiply, divide, power, sqrt, percent"

// infallible adapts a binary operation that cannot fail to the common signature.
func infallible(fn func(a, b float64) float64) func(a, b float64) (float64, error) {
	return func(a, b float64) (float64, error) {
		return fn(a, b), nil
	}
}

// infallibleUnary adapts a single-operand operation that cannot fail.
func infallibleUnary(fn func(x float64) float64) func(x float64) (float64, error) {
	return func(x float64) (float64, error) {
		return fn(x), nil
	}
}

// unary adapts a single-operand operation to the common signature.
func unary(fn func(x float64) (float64, error)) func(a, b float64) (float64, error) {
	return func(a, _ float64) (float64, error) {
		return fn(a)
	}
}

// calculationErrorCode returns the API code for a calculator error caused by
// the operands, which clients should be told about. ok is false for any
// other error.
func calculationErrorCode(err error) (code string, ok bool) {
	switch {
	case errors.Is(err, calculator.ErrDivisionByZero):
		return codeDivisionByZero, true
	case errors.Is(err, calculator.ErrNotRealNumber):
		return codeNotARealNumber, true
	case errors.Is(err, calculator.ErrNegativeSquareRoot):
		return codeNegativeSquareRoot, true
	}
	return "", false
}

func handleCalculate(w http.ResponseWriter, r *http.Request) {
	if !isJSON(r.Header.Get("Content-Type")) {
		writeError(w, http.StatusUnsupportedMediaType, codeUnsupportedMediaType, "Content-Type must be application/json")
		return
	}

	req, apiErr := decodeCalculateRequest(http.MaxBytesReader(w, r.Body, maxRequestBytes))
	if apiErr != nil {
		writeError(w, apiErr.status, apiErr.code, apiErr.message)
		return
	}

	result, err := operations[req.Operation].apply(req.A, req.B)
	if code, ok := calculationErrorCode(err); ok {
		writeError(w, http.StatusUnprocessableEntity, code, err.Error())
		return
	}
	if err != nil {
		log.Printf("calculate %s: %v", req.Operation, err)
		writeError(w, http.StatusInternalServerError, codeInternalError, "internal server error")
		return
	}
	if math.IsInf(result, 0) || math.IsNaN(result) {
		writeError(w, http.StatusUnprocessableEntity, codeResultOutOfRange, "result is out of range")
		return
	}

	writeJSON(w, http.StatusOK, calculateResponse{Result: result})
}

// apiError is a client-facing error with the HTTP status to respond with.
type apiError struct {
	status  int
	code    string
	message string
}

func badRequest(code, format string, args ...any) *apiError {
	return &apiError{status: http.StatusBadRequest, code: code, message: fmt.Sprintf(format, args...)}
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
//  5. a is present, a number, and within float64 range (400)
//  6. b likewise, for operations with two operands; for operations with one
//     operand, b must be absent (400)
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
	if operations[op].unary {
		// Rejected rather than ignored, so a client that sends a second
		// operand by mistake finds out.
		if !isNull(fields["b"]) {
			return calculateRequest{}, badRequest(codeFieldNotAllowed, `field "b" is not allowed for operation %q`, op)
		}
		return calculateRequest{Operation: op, A: a}, nil
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
			return nil, badRequest(codeInvalidJSON, "request body must not be empty")
		}
		return nil, syntaxError(err)
	}
	if tok != json.Delim('{') {
		return nil, badRequest(codeInvalidJSON, "request body must be a valid JSON object")
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
			fieldErr = badRequest(codeUnknownField, "request body contains unknown field %q", key)
		} else if fieldErr == nil && seen {
			fieldErr = badRequest(codeDuplicateField, "request body contains duplicate field %q", key)
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
		return nil, badRequest(codeInvalidJSON, "request body must contain a single JSON object")
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
			code:    codeBodyTooLarge,
			message: fmt.Sprintf("request body must not exceed %d bytes", maxRequestBytes),
		}
	}
	return badRequest(codeInvalidJSON, "request body contains malformed JSON")
}

// isNull reports whether a field is absent or explicitly null.
func isNull(raw json.RawMessage) bool {
	return raw == nil || string(raw) == "null"
}

func operationField(fields map[string]json.RawMessage) (string, *apiError) {
	raw := fields["operation"]
	if isNull(raw) {
		return "", badRequest(codeMissingField, `field "operation" is required`)
	}
	var op string
	if err := json.Unmarshal(raw, &op); err != nil {
		return "", badRequest(codeInvalidFieldType, `field "operation" must be a string`)
	}
	if op == "" {
		return "", badRequest(codeMissingField, `field "operation" is required`)
	}
	if _, ok := operations[op]; !ok {
		return "", badRequest(codeUnsupportedOperation, "unsupported operation %q: must be one of %s", op, supportedOperations)
	}
	return op, nil
}

func numberField(fields map[string]json.RawMessage, name string) (float64, *apiError) {
	raw := fields[name]
	if isNull(raw) {
		return 0, badRequest(codeMissingField, "field %q is required", name)
	}
	var n float64
	if err := json.Unmarshal(raw, &n); err != nil {
		// A JSON number starts with '-' or a digit; if it still failed to
		// decode, it does not fit in a float64.
		if c := raw[0]; c == '-' || (c >= '0' && c <= '9') {
			return 0, badRequest(codeFieldOutOfRange, "field %q is out of range", name)
		}
		return 0, badRequest(codeInvalidFieldType, "field %q must be a number", name)
	}
	return n, nil
}

// isJSON reports whether a Content-Type header value is application/json,
// ignoring parameters such as charset.
func isJSON(contentType string) bool {
	mediaType, _, err := mime.ParseMediaType(contentType)
	return err == nil && mediaType == "application/json"
}
