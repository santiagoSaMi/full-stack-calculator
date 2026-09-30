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
	"strings"

	"github.com/santiagoSaMi/full-stack-calculator/backend/internal/calculator"
)

// maxRequestBytes caps the size of a calculate request body.
const maxRequestBytes = 1 << 10 // 1 KiB

// calculateRequest is the JSON body accepted by POST /api/v1/calculate.
// Operands are pointers so a missing field can be told apart from zero.
type calculateRequest struct {
	Operation string   `json:"operation"`
	A         *float64 `json:"a"`
	B         *float64 `json:"b"`
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

	req, status, err := decodeCalculateRequest(w, r)
	if err != nil {
		writeError(w, status, err.Error())
		return
	}

	op, ok := operations[req.Operation]
	if !ok {
		writeError(w, http.StatusBadRequest,
			fmt.Sprintf("unsupported operation %q: must be one of add, subtract, multiply, divide", req.Operation))
		return
	}

	result, err := op(*req.A, *req.B)
	if errors.Is(err, calculator.ErrDivisionByZero) {
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

// decodeCalculateRequest parses and validates the request body. On failure it
// returns the HTTP status code to respond with and a client-facing error.
func decodeCalculateRequest(w http.ResponseWriter, r *http.Request) (calculateRequest, int, error) {
	var req calculateRequest

	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRequestBytes))
	dec.DisallowUnknownFields()

	if err := dec.Decode(&req); err != nil {
		var (
			maxBytesErr  *http.MaxBytesError
			syntaxErr    *json.SyntaxError
			typeErr      *json.UnmarshalTypeError
			unknownField = strings.HasPrefix(err.Error(), "json: unknown field ")
		)
		switch {
		case errors.As(err, &maxBytesErr):
			return req, http.StatusRequestEntityTooLarge, fmt.Errorf("request body must not exceed %d bytes", maxRequestBytes)
		case errors.Is(err, io.EOF):
			return req, http.StatusBadRequest, errors.New("request body must not be empty")
		case errors.As(err, &typeErr) && typeErr.Field != "":
			return req, http.StatusBadRequest, fmt.Errorf("field %q has an invalid type", typeErr.Field)
		case unknownField:
			return req, http.StatusBadRequest, fmt.Errorf("request body contains %s", strings.TrimPrefix(err.Error(), "json: "))
		case errors.As(err, &syntaxErr), errors.Is(err, io.ErrUnexpectedEOF):
			return req, http.StatusBadRequest, errors.New("request body contains malformed JSON")
		default:
			return req, http.StatusBadRequest, errors.New("request body must be a valid JSON object")
		}
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return req, http.StatusBadRequest, errors.New("request body must contain a single JSON object")
	}

	switch {
	case req.Operation == "":
		return req, http.StatusBadRequest, errors.New(`field "operation" is required`)
	case req.A == nil:
		return req, http.StatusBadRequest, errors.New(`field "a" is required`)
	case req.B == nil:
		return req, http.StatusBadRequest, errors.New(`field "b" is required`)
	}

	return req, 0, nil
}

// isJSON reports whether a Content-Type header value is application/json,
// ignoring parameters such as charset.
func isJSON(contentType string) bool {
	mediaType, _, err := mime.ParseMediaType(contentType)
	return err == nil && mediaType == "application/json"
}
