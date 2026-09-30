package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const calculatePath = "/api/v1/calculate"

// doCalculate sends body to the calculate endpoint with the given
// Content-Type and returns the recorded response.
func doCalculate(t *testing.T, contentType, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, calculatePath, strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	NewHandler().ServeHTTP(rec, req)
	return rec
}

func assertJSONContentType(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want %q", got, "application/json")
	}
}

func TestCalculateSuccess(t *testing.T) {
	tests := []struct {
		name string
		body string
		want float64
	}{
		{"add", `{"operation":"add","a":10,"b":5}`, 15},
		{"subtract", `{"operation":"subtract","a":10,"b":5}`, 5},
		{"multiply", `{"operation":"multiply","a":10,"b":5}`, 50},
		{"divide", `{"operation":"divide","a":10,"b":5}`, 2},
		{"negative operands", `{"operation":"add","a":-10,"b":-5}`, -15},
		{"decimal operands", `{"operation":"multiply","a":1.5,"b":2.5}`, 3.75},
		{"fractional quotient", `{"operation":"divide","a":1,"b":4}`, 0.25},
		{"explicit zero operands", `{"operation":"add","a":0,"b":0}`, 0},
		{"zero dividend", `{"operation":"divide","a":0,"b":5}`, 0},
		{"exponent notation", `{"operation":"add","a":1e3,"b":2E-1}`, 1000.2},
		{"fields in any order", `{"b":5,"a":10,"operation":"subtract"}`, 5},
		{"surrounding whitespace", "\n  {\"operation\":\"add\",\"a\":1,\"b\":2}  \n", 3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doCalculate(t, "application/json", tt.body)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body)
			}
			assertJSONContentType(t, rec)

			var resp calculateResponse
			if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if resp.Result != tt.want {
				t.Errorf("result = %v, want %v", resp.Result, tt.want)
			}
		})
	}
}

func TestCalculateResponseShape(t *testing.T) {
	rec := doCalculate(t, "application/json", `{"operation":"add","a":10,"b":5}`)

	if got, want := rec.Body.String(), "{\"result\":15}\n"; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestCalculateErrors(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		body        string
		wantStatus  int
		wantError   string
	}{
		// Domain errors.
		{
			name: "division by zero", contentType: "application/json",
			body:       `{"operation":"divide","a":10,"b":0}`,
			wantStatus: http.StatusUnprocessableEntity, wantError: "division by zero",
		},
		{
			name: "division of zero by zero", contentType: "application/json",
			body:       `{"operation":"divide","a":0,"b":0}`,
			wantStatus: http.StatusUnprocessableEntity, wantError: "division by zero",
		},
		{
			name: "overflow to infinity", contentType: "application/json",
			body:       `{"operation":"multiply","a":1e308,"b":10}`,
			wantStatus: http.StatusUnprocessableEntity, wantError: "result is out of range",
		},

		// Unsupported operations.
		{
			name: "unknown operation", contentType: "application/json",
			body:       `{"operation":"modulo","a":10,"b":5}`,
			wantStatus: http.StatusBadRequest,
			wantError:  `unsupported operation "modulo": must be one of add, subtract, multiply, divide`,
		},
		{
			name: "operation is case sensitive", contentType: "application/json",
			body:       `{"operation":"ADD","a":10,"b":5}`,
			wantStatus: http.StatusBadRequest,
			wantError:  `unsupported operation "ADD": must be one of add, subtract, multiply, divide`,
		},
		{
			name: "operator symbol", contentType: "application/json",
			body:       `{"operation":"+","a":10,"b":5}`,
			wantStatus: http.StatusBadRequest,
			wantError:  `unsupported operation "+": must be one of add, subtract, multiply, divide`,
		},

		// Missing or null fields.
		{
			name: "missing operation", contentType: "application/json",
			body:       `{"a":10,"b":5}`,
			wantStatus: http.StatusBadRequest, wantError: `field "operation" is required`,
		},
		{
			name: "empty operation", contentType: "application/json",
			body:       `{"operation":"","a":10,"b":5}`,
			wantStatus: http.StatusBadRequest, wantError: `field "operation" is required`,
		},
		{
			name: "missing a", contentType: "application/json",
			body:       `{"operation":"add","b":5}`,
			wantStatus: http.StatusBadRequest, wantError: `field "a" is required`,
		},
		{
			name: "missing b", contentType: "application/json",
			body:       `{"operation":"add","a":10}`,
			wantStatus: http.StatusBadRequest, wantError: `field "b" is required`,
		},
		{
			name: "null a", contentType: "application/json",
			body:       `{"operation":"add","a":null,"b":5}`,
			wantStatus: http.StatusBadRequest, wantError: `field "a" is required`,
		},
		{
			name: "empty object", contentType: "application/json",
			body:       `{}`,
			wantStatus: http.StatusBadRequest, wantError: `field "operation" is required`,
		},

		// Wrong field types.
		{
			name: "string operand", contentType: "application/json",
			body:       `{"operation":"add","a":"10","b":5}`,
			wantStatus: http.StatusBadRequest, wantError: `field "a" has an invalid type`,
		},
		{
			name: "boolean operand", contentType: "application/json",
			body:       `{"operation":"add","a":10,"b":true}`,
			wantStatus: http.StatusBadRequest, wantError: `field "b" has an invalid type`,
		},
		{
			name: "numeric operation", contentType: "application/json",
			body:       `{"operation":1,"a":10,"b":5}`,
			wantStatus: http.StatusBadRequest, wantError: `field "operation" has an invalid type`,
		},
		{
			name: "operand outside float64 range", contentType: "application/json",
			body:       `{"operation":"add","a":1e400,"b":5}`,
			wantStatus: http.StatusBadRequest, wantError: `field "a" has an invalid type`,
		},

		// Malformed or unexpected bodies.
		{
			name: "empty body", contentType: "application/json",
			body:       ``,
			wantStatus: http.StatusBadRequest, wantError: "request body must not be empty",
		},
		{
			name: "truncated JSON", contentType: "application/json",
			body:       `{"operation":"add","a":10`,
			wantStatus: http.StatusBadRequest, wantError: "request body contains malformed JSON",
		},
		{
			name: "invalid JSON syntax", contentType: "application/json",
			body:       `{operation: add}`,
			wantStatus: http.StatusBadRequest, wantError: "request body contains malformed JSON",
		},
		{
			name: "trailing comma", contentType: "application/json",
			body:       `{"operation":"add","a":10,"b":5,}`,
			wantStatus: http.StatusBadRequest, wantError: "request body contains malformed JSON",
		},
		{
			name: "array instead of object", contentType: "application/json",
			body:       `[1,2]`,
			wantStatus: http.StatusBadRequest, wantError: "request body must be a valid JSON object",
		},
		{
			name: "unknown field", contentType: "application/json",
			body:       `{"operation":"add","a":10,"b":5,"c":1}`,
			wantStatus: http.StatusBadRequest, wantError: `request body contains unknown field "c"`,
		},
		{
			name: "multiple JSON objects", contentType: "application/json",
			body:       `{"operation":"add","a":10,"b":5}{"operation":"add","a":1,"b":1}`,
			wantStatus: http.StatusBadRequest, wantError: "request body must contain a single JSON object",
		},
		{
			name: "trailing garbage", contentType: "application/json",
			body:       `{"operation":"add","a":10,"b":5}}`,
			wantStatus: http.StatusBadRequest, wantError: "request body must contain a single JSON object",
		},
		{
			name: "body too large", contentType: "application/json",
			body:       `{"operation":"add","a":10,"b":5,"pad":"` + strings.Repeat("x", maxRequestBytes) + `"}`,
			wantStatus: http.StatusRequestEntityTooLarge, wantError: "request body must not exceed 1024 bytes",
		},

		// Content-Type.
		{
			name: "missing content type", contentType: "",
			body:       `{"operation":"add","a":10,"b":5}`,
			wantStatus: http.StatusUnsupportedMediaType, wantError: "Content-Type must be application/json",
		},
		{
			name: "wrong content type", contentType: "text/plain",
			body:       `{"operation":"add","a":10,"b":5}`,
			wantStatus: http.StatusUnsupportedMediaType, wantError: "Content-Type must be application/json",
		},
		{
			name: "form content type", contentType: "application/x-www-form-urlencoded",
			body:       `operation=add&a=10&b=5`,
			wantStatus: http.StatusUnsupportedMediaType, wantError: "Content-Type must be application/json",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doCalculate(t, tt.contentType, tt.body)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", rec.Code, tt.wantStatus, rec.Body)
			}
			assertJSONContentType(t, rec)

			var resp errorResponse
			if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
				t.Fatalf("decode error response: %v", err)
			}
			if resp.Error != tt.wantError {
				t.Errorf("error = %q, want %q", resp.Error, tt.wantError)
			}
		})
	}
}

func TestCalculateAcceptsContentTypeParameters(t *testing.T) {
	for _, ct := range []string{"application/json; charset=utf-8", "Application/JSON"} {
		t.Run(ct, func(t *testing.T) {
			rec := doCalculate(t, ct, `{"operation":"add","a":1,"b":2}`)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body)
			}
		})
	}
}

func TestCalculateRejectsOtherMethods(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete, http.MethodPatch} {
		t.Run(method, func(t *testing.T) {
			req := httptest.NewRequest(method, calculatePath, nil)
			rec := httptest.NewRecorder()

			NewHandler().ServeHTTP(rec, req)

			if rec.Code != http.StatusMethodNotAllowed {
				t.Fatalf("status = %d, want %d", rec.Code, http.StatusMethodNotAllowed)
			}
			if got := rec.Header().Get("Allow"); got != "POST" {
				t.Errorf("Allow = %q, want %q", got, "POST")
			}
		})
	}
}

func TestCalculateUnversionedPathNotFound(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/calculate", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	NewHandler().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}
