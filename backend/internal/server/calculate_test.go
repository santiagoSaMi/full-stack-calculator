package server_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/santiagoSaMi/full-stack-calculator/backend/internal/server"
)

const (
	calculatePath = "/api/v1/calculate"
	jsonType      = "application/json"
)

// newTestServer starts a real HTTP server backed by the application handler
// and closes it when the test ends.
func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	ts := httptest.NewServer(server.NewHandler())
	t.Cleanup(ts.Close)
	return ts
}

// response is the relevant part of an HTTP response, read in full.
type response struct {
	status int
	header http.Header
	body   []byte
}

// send performs an HTTP request against ts and returns the full response.
// An empty contentType sends no Content-Type header.
func send(t *testing.T, ts *httptest.Server, method, path, contentType, body string) response {
	t.Helper()
	req, err := http.NewRequest(method, ts.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("send request: %v", err)
	}
	defer res.Body.Close()

	data, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}
	return response{status: res.StatusCode, header: res.Header, body: data}
}

// assertJSON checks the Content-Type and that the body is exactly the JSON
// document want: same keys and same values, with no extra fields.
func assertJSON(t *testing.T, res response, want string) {
	t.Helper()
	if got := res.header.Get("Content-Type"); got != jsonType {
		t.Errorf("Content-Type = %q, want %q", got, jsonType)
	}

	var gotBody, wantBody any
	if err := json.Unmarshal(res.body, &gotBody); err != nil {
		t.Fatalf("response body is not valid JSON: %v; body = %s", err, res.body)
	}
	if err := json.Unmarshal([]byte(want), &wantBody); err != nil {
		t.Fatalf("invalid expected JSON in test: %v", err)
	}
	if !reflect.DeepEqual(gotBody, wantBody) {
		t.Errorf("body = %s, want %s", strings.TrimSpace(string(res.body)), want)
	}
}

// apiCase is one request to the calculate endpoint and its expected response.
type apiCase struct {
	name        string
	method      string // defaults to POST
	contentType string // defaults to application/json; "-" sends none
	body        string
	wantStatus  int
	wantBody    string
}

func runAPICases(t *testing.T, tests []apiCase) {
	t.Helper()
	ts := newTestServer(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			method := tt.method
			if method == "" {
				method = http.MethodPost
			}
			contentType := tt.contentType
			switch contentType {
			case "":
				contentType = jsonType
			case "-":
				contentType = ""
			}

			res := send(t, ts, method, calculatePath, contentType, tt.body)

			if res.status != tt.wantStatus {
				t.Errorf("status = %d, want %d", res.status, tt.wantStatus)
			}
			assertJSON(t, res, tt.wantBody)
		})
	}
}

func TestCalculateAddition(t *testing.T) {
	runAPICases(t, []apiCase{
		{name: "positive", body: `{"operation":"add","a":10,"b":5}`, wantStatus: 200, wantBody: `{"result":15}`},
		{name: "negative", body: `{"operation":"add","a":-10,"b":-5}`, wantStatus: 200, wantBody: `{"result":-15}`},
		{name: "mixed signs", body: `{"operation":"add","a":-10,"b":5}`, wantStatus: 200, wantBody: `{"result":-5}`},
		{name: "decimal", body: `{"operation":"add","a":1.5,"b":2.25}`, wantStatus: 200, wantBody: `{"result":3.75}`},
		{name: "zero", body: `{"operation":"add","a":0,"b":0}`, wantStatus: 200, wantBody: `{"result":0}`},
		{name: "exponent notation", body: `{"operation":"add","a":1e3,"b":2E-1}`, wantStatus: 200, wantBody: `{"result":1000.2}`},
	})
}

func TestCalculateSubtraction(t *testing.T) {
	runAPICases(t, []apiCase{
		{name: "positive result", body: `{"operation":"subtract","a":10,"b":5}`, wantStatus: 200, wantBody: `{"result":5}`},
		{name: "negative result", body: `{"operation":"subtract","a":5,"b":10}`, wantStatus: 200, wantBody: `{"result":-5}`},
		{name: "negative operands", body: `{"operation":"subtract","a":-2,"b":-3}`, wantStatus: 200, wantBody: `{"result":1}`},
		{name: "decimal", body: `{"operation":"subtract","a":5.5,"b":2.25}`, wantStatus: 200, wantBody: `{"result":3.25}`},
		{name: "zero", body: `{"operation":"subtract","a":0,"b":5}`, wantStatus: 200, wantBody: `{"result":-5}`},
	})
}

func TestCalculateMultiplication(t *testing.T) {
	runAPICases(t, []apiCase{
		{name: "positive", body: `{"operation":"multiply","a":10,"b":5}`, wantStatus: 200, wantBody: `{"result":50}`},
		{name: "mixed signs", body: `{"operation":"multiply","a":-4,"b":3}`, wantStatus: 200, wantBody: `{"result":-12}`},
		{name: "negative operands", body: `{"operation":"multiply","a":-4,"b":-3}`, wantStatus: 200, wantBody: `{"result":12}`},
		{name: "decimal", body: `{"operation":"multiply","a":1.5,"b":2.5}`, wantStatus: 200, wantBody: `{"result":3.75}`},
		{name: "by zero", body: `{"operation":"multiply","a":7,"b":0}`, wantStatus: 200, wantBody: `{"result":0}`},
		{
			name:       "overflow",
			body:       `{"operation":"multiply","a":1e308,"b":10}`,
			wantStatus: 422, wantBody: `{"error":"result is out of range"}`,
		},
	})
}

func TestCalculateDivision(t *testing.T) {
	runAPICases(t, []apiCase{
		{name: "exact", body: `{"operation":"divide","a":10,"b":5}`, wantStatus: 200, wantBody: `{"result":2}`},
		{name: "fractional", body: `{"operation":"divide","a":7,"b":2}`, wantStatus: 200, wantBody: `{"result":3.5}`},
		{name: "mixed signs", body: `{"operation":"divide","a":-9,"b":3}`, wantStatus: 200, wantBody: `{"result":-3}`},
		{name: "decimal", body: `{"operation":"divide","a":7.5,"b":2.5}`, wantStatus: 200, wantBody: `{"result":3}`},
		{name: "zero dividend", body: `{"operation":"divide","a":0,"b":5}`, wantStatus: 200, wantBody: `{"result":0}`},
	})
}

func TestCalculatePower(t *testing.T) {
	const (
		divisionByZero = `{"error":"division by zero"}`
		notReal        = `{"error":"result is not a real number"}`
		outOfRange     = `{"error":"result is out of range"}`
	)
	runAPICases(t, []apiCase{
		{name: "positive", body: `{"operation":"power","a":2,"b":10}`, wantStatus: 200, wantBody: `{"result":1024}`},
		{name: "exponent of zero", body: `{"operation":"power","a":5,"b":0}`, wantStatus: 200, wantBody: `{"result":1}`},
		{name: "zero to zero", body: `{"operation":"power","a":0,"b":0}`, wantStatus: 200, wantBody: `{"result":1}`},
		{name: "zero base", body: `{"operation":"power","a":0,"b":3}`, wantStatus: 200, wantBody: `{"result":0}`},
		{name: "negative exponent", body: `{"operation":"power","a":2,"b":-2}`, wantStatus: 200, wantBody: `{"result":0.25}`},
		{name: "negative base, even exponent", body: `{"operation":"power","a":-2,"b":2}`, wantStatus: 200, wantBody: `{"result":4}`},
		{name: "negative base, odd exponent", body: `{"operation":"power","a":-2,"b":3}`, wantStatus: 200, wantBody: `{"result":-8}`},
		{name: "square root", body: `{"operation":"power","a":9,"b":0.5}`, wantStatus: 200, wantBody: `{"result":3}`},
		{name: "decimal base", body: `{"operation":"power","a":1.5,"b":2}`, wantStatus: 200, wantBody: `{"result":2.25}`},
		{name: "zero to a negative exponent", body: `{"operation":"power","a":0,"b":-1}`, wantStatus: 422, wantBody: divisionByZero},
		{name: "negative base, fractional exponent", body: `{"operation":"power","a":-4,"b":0.5}`, wantStatus: 422, wantBody: notReal},
		{name: "overflow", body: `{"operation":"power","a":10,"b":400}`, wantStatus: 422, wantBody: outOfRange},
		{name: "negative overflow", body: `{"operation":"power","a":-10,"b":401}`, wantStatus: 422, wantBody: outOfRange},
		{name: "underflow to zero", body: `{"operation":"power","a":10,"b":-400}`, wantStatus: 200, wantBody: `{"result":0}`},
		{
			name: "missing exponent", body: `{"operation":"power","a":2}`,
			wantStatus: 400, wantBody: `{"error":"field \"b\" is required"}`,
		},
		{
			name: "wrong case", body: `{"operation":"Power","a":2,"b":3}`,
			wantStatus: 400,
			wantBody:   `{"error":"unsupported operation \"Power\": must be one of add, subtract, multiply, divide, power, sqrt, percent"}`,
		},
	})
}

func TestCalculateSquareRoot(t *testing.T) {
	const (
		negative     = `{"error":"square root of a negative number"}`
		bNotAllowed  = `{"error":"field \"b\" is not allowed for operation \"sqrt\""}`
		aRequired    = `{"error":"field \"a\" is required"}`
		aNotANumber  = `{"error":"field \"a\" must be a number"}`
		aOutOfRange  = `{"error":"field \"a\" is out of range"}`
		unknownField = `{"error":"request body contains unknown field \"x\""}`
	)
	runAPICases(t, []apiCase{
		// Valid requests take a single operand.
		{name: "perfect square", body: `{"operation":"sqrt","a":9}`, wantStatus: 200, wantBody: `{"result":3}`},
		{name: "decimal operand", body: `{"operation":"sqrt","a":2.25}`, wantStatus: 200, wantBody: `{"result":1.5}`},
		{name: "decimal result", body: `{"operation":"sqrt","a":0.25}`, wantStatus: 200, wantBody: `{"result":0.5}`},
		{name: "irrational result", body: `{"operation":"sqrt","a":2}`, wantStatus: 200, wantBody: `{"result":1.4142135623730951}`},
		{name: "zero", body: `{"operation":"sqrt","a":0}`, wantStatus: 200, wantBody: `{"result":0}`},
		{name: "negative zero", body: `{"operation":"sqrt","a":-0}`, wantStatus: 200, wantBody: `{"result":0}`},
		{name: "large operand", body: `{"operation":"sqrt","a":1e300}`, wantStatus: 200, wantBody: `{"result":1e150}`},
		{name: "fields in any order", body: `{"a":16,"operation":"sqrt"}`, wantStatus: 200, wantBody: `{"result":4}`},
		{name: "explicit null b is treated as absent", body: `{"operation":"sqrt","a":9,"b":null}`, wantStatus: 200, wantBody: `{"result":3}`},

		// Negative operands.
		{name: "negative integer", body: `{"operation":"sqrt","a":-9}`, wantStatus: 422, wantBody: negative},
		{name: "negative decimal", body: `{"operation":"sqrt","a":-0.25}`, wantStatus: 422, wantBody: negative},
		{name: "tiny negative", body: `{"operation":"sqrt","a":-1e-300}`, wantStatus: 422, wantBody: negative},

		// A second operand is rejected rather than ignored.
		{name: "with b", body: `{"operation":"sqrt","a":9,"b":2}`, wantStatus: 400, wantBody: bNotAllowed},
		{name: "with b of zero", body: `{"operation":"sqrt","a":9,"b":0}`, wantStatus: 400, wantBody: bNotAllowed},
		{name: "with b of the wrong type", body: `{"operation":"sqrt","a":9,"b":"x"}`, wantStatus: 400, wantBody: bNotAllowed},

		// The operand is validated like any other.
		{name: "missing a", body: `{"operation":"sqrt"}`, wantStatus: 400, wantBody: aRequired},
		{name: "null a", body: `{"operation":"sqrt","a":null}`, wantStatus: 400, wantBody: aRequired},
		{name: "only b", body: `{"operation":"sqrt","b":9}`, wantStatus: 400, wantBody: aRequired},
		{name: "string a", body: `{"operation":"sqrt","a":"9"}`, wantStatus: 400, wantBody: aNotANumber},
		{name: "a out of range", body: `{"operation":"sqrt","a":1e400}`, wantStatus: 400, wantBody: aOutOfRange},
		{name: "unknown field", body: `{"operation":"sqrt","a":9,"x":1}`, wantStatus: 400, wantBody: unknownField},

		// Validation order: a problem with a is reported before the extra b.
		{name: "invalid a before extra b", body: `{"operation":"sqrt","a":"9","b":2}`, wantStatus: 400, wantBody: aNotANumber},
		// A negative operand is only judged once the request is valid.
		{name: "extra b before negative a", body: `{"operation":"sqrt","a":-9,"b":2}`, wantStatus: 400, wantBody: bNotAllowed},
		{
			name: "wrong case", body: `{"operation":"SQRT","a":9}`,
			wantStatus: 400,
			wantBody:   `{"error":"unsupported operation \"SQRT\": must be one of add, subtract, multiply, divide, power, sqrt, percent"}`,
		},
	})
}

func TestCalculatePercent(t *testing.T) {
	const (
		bNotAllowed = `{"error":"field \"b\" is not allowed for operation \"percent\""}`
		aRequired   = `{"error":"field \"a\" is required"}`
		aNotANumber = `{"error":"field \"a\" must be a number"}`
		aOutOfRange = `{"error":"field \"a\" is out of range"}`
	)
	unsupported := func(op string) string {
		return `{"error":"unsupported operation \"` + op + `\": must be one of add, subtract, multiply, divide, power, sqrt, percent"}`
	}
	runAPICases(t, []apiCase{
		// Valid requests take a single operand and return it divided by 100.
		{name: "fifty", body: `{"operation":"percent","a":50}`, wantStatus: 200, wantBody: `{"result":0.5}`},
		{name: "one hundred", body: `{"operation":"percent","a":100}`, wantStatus: 200, wantBody: `{"result":1}`},
		{name: "more than one hundred", body: `{"operation":"percent","a":250}`, wantStatus: 200, wantBody: `{"result":2.5}`},
		{name: "one", body: `{"operation":"percent","a":1}`, wantStatus: 200, wantBody: `{"result":0.01}`},
		{name: "zero", body: `{"operation":"percent","a":0}`, wantStatus: 200, wantBody: `{"result":0}`},
		{name: "negative", body: `{"operation":"percent","a":-50}`, wantStatus: 200, wantBody: `{"result":-0.5}`},
		{name: "decimal", body: `{"operation":"percent","a":12.5}`, wantStatus: 200, wantBody: `{"result":0.125}`},
		{name: "decimal below one", body: `{"operation":"percent","a":0.5}`, wantStatus: 200, wantBody: `{"result":0.005}`},
		{name: "largest operand does not overflow", body: `{"operation":"percent","a":1e308}`, wantStatus: 200, wantBody: `{"result":1e306}`},
		{name: "fields in any order", body: `{"a":25,"operation":"percent"}`, wantStatus: 200, wantBody: `{"result":0.25}`},
		{name: "explicit null b is treated as absent", body: `{"operation":"percent","a":50,"b":null}`, wantStatus: 200, wantBody: `{"result":0.5}`},

		// A second operand is rejected: "a percent of b" is a multiplication.
		{name: "with b", body: `{"operation":"percent","a":10,"b":200}`, wantStatus: 400, wantBody: bNotAllowed},
		{name: "with b of zero", body: `{"operation":"percent","a":10,"b":0}`, wantStatus: 400, wantBody: bNotAllowed},

		// The operand is validated like any other.
		{name: "missing a", body: `{"operation":"percent"}`, wantStatus: 400, wantBody: aRequired},
		{name: "null a", body: `{"operation":"percent","a":null}`, wantStatus: 400, wantBody: aRequired},
		{name: "only b", body: `{"operation":"percent","b":50}`, wantStatus: 400, wantBody: aRequired},
		{name: "string a", body: `{"operation":"percent","a":"50"}`, wantStatus: 400, wantBody: aNotANumber},
		{name: "string a with a percent sign", body: `{"operation":"percent","a":"50%"}`, wantStatus: 400, wantBody: aNotANumber},
		{name: "a out of range", body: `{"operation":"percent","a":1e400}`, wantStatus: 400, wantBody: aOutOfRange},

		// Only the exact name is accepted.
		{name: "symbol", body: `{"operation":"%","a":50}`, wantStatus: 400, wantBody: unsupported("%")},
		{name: "long name", body: `{"operation":"percentage","a":50}`, wantStatus: 400, wantBody: unsupported("percentage")},
		{name: "wrong case", body: `{"operation":"Percent","a":50}`, wantStatus: 400, wantBody: unsupported("Percent")},
		{name: "modulo is not percent", body: `{"operation":"modulo","a":10,"b":3}`, wantStatus: 400, wantBody: unsupported("modulo")},
	})
}

// TestCalculatePercentOfAValue shows the documented way to take a percentage
// of a number through the API: convert the rate with "percent", then multiply.
func TestCalculatePercentOfAValue(t *testing.T) {
	ts := newTestServer(t)

	rate := send(t, ts, http.MethodPost, calculatePath, jsonType, `{"operation":"percent","a":10}`)
	assertJSON(t, rate, `{"result":0.1}`)

	product := send(t, ts, http.MethodPost, calculatePath, jsonType, `{"operation":"multiply","a":200,"b":0.1}`)
	if product.status != http.StatusOK {
		t.Fatalf("status = %d, want %d", product.status, http.StatusOK)
	}
	assertJSON(t, product, `{"result":20}`)
}

// TestCalculateBinaryOperationsStillRequireB guards the contract of the
// two-operand operations after single-operand requests were introduced.
func TestCalculateBinaryOperationsStillRequireB(t *testing.T) {
	const bRequired = `{"error":"field \"b\" is required"}`
	ts := newTestServer(t)
	for _, operation := range []string{"add", "subtract", "multiply", "divide", "power"} {
		t.Run(operation, func(t *testing.T) {
			for _, body := range []string{
				`{"operation":"` + operation + `","a":9}`,
				`{"operation":"` + operation + `","a":9,"b":null}`,
			} {
				res := send(t, ts, http.MethodPost, calculatePath, jsonType, body)
				if res.status != http.StatusBadRequest {
					t.Errorf("%s: status = %d, want %d", body, res.status, http.StatusBadRequest)
				}
				assertJSON(t, res, bRequired)
			}
		})
	}
}

func TestCalculateDivisionByZero(t *testing.T) {
	const want = `{"error":"division by zero"}`
	runAPICases(t, []apiCase{
		{name: "positive dividend", body: `{"operation":"divide","a":10,"b":0}`, wantStatus: 422, wantBody: want},
		{name: "negative dividend", body: `{"operation":"divide","a":-10,"b":0}`, wantStatus: 422, wantBody: want},
		{name: "zero dividend", body: `{"operation":"divide","a":0,"b":0}`, wantStatus: 422, wantBody: want},
		{name: "decimal zero divisor", body: `{"operation":"divide","a":10,"b":0.0}`, wantStatus: 422, wantBody: want},
		{name: "negative zero divisor", body: `{"operation":"divide","a":10,"b":-0}`, wantStatus: 422, wantBody: want},
	})
}

func TestCalculateUnsupportedOperation(t *testing.T) {
	unsupported := func(op string) string {
		return `{"error":"unsupported operation \"` + op + `\": must be one of add, subtract, multiply, divide, power, sqrt, percent"}`
	}
	runAPICases(t, []apiCase{
		{name: "unknown name", body: `{"operation":"modulo","a":10,"b":5}`, wantStatus: 400, wantBody: unsupported("modulo")},
		{name: "advanced operation", body: `{"operation":"log","a":2,"b":3}`, wantStatus: 400, wantBody: unsupported("log")},
		{name: "long name for sqrt", body: `{"operation":"squareroot","a":9}`, wantStatus: 400, wantBody: unsupported("squareroot")},
		{name: "symbol for sqrt", body: `{"operation":"√","a":9}`, wantStatus: 400, wantBody: unsupported("√")},
		{name: "abbreviated name", body: `{"operation":"pow","a":2,"b":3}`, wantStatus: 400, wantBody: unsupported("pow")},
		{name: "operator symbol for power", body: `{"operation":"^","a":2,"b":3}`, wantStatus: 400, wantBody: unsupported("^")},
		{name: "wrong case", body: `{"operation":"ADD","a":10,"b":5}`, wantStatus: 400, wantBody: unsupported("ADD")},
		{name: "operator symbol", body: `{"operation":"+","a":10,"b":5}`, wantStatus: 400, wantBody: unsupported("+")},
		{name: "surrounding spaces", body: `{"operation":" add ","a":10,"b":5}`, wantStatus: 400, wantBody: unsupported(" add ")},
	})
}

func TestCalculateMalformedJSON(t *testing.T) {
	const malformed = `{"error":"request body contains malformed JSON"}`
	runAPICases(t, []apiCase{
		{name: "truncated", body: `{"operation":"add","a":10`, wantStatus: 400, wantBody: malformed},
		{name: "truncated after value", body: `{"operation":"add","a":10,"b":5`, wantStatus: 400, wantBody: malformed},
		{name: "mismatched bracket", body: `{"operation":"add","a":10,"b":5]`, wantStatus: 400, wantBody: malformed},
		{name: "unquoted keys", body: `{operation: add}`, wantStatus: 400, wantBody: malformed},
		{name: "trailing comma", body: `{"operation":"add","a":10,"b":5,}`, wantStatus: 400, wantBody: malformed},
		{name: "single quotes", body: `{'operation':'add','a':10,'b':5}`, wantStatus: 400, wantBody: malformed},
		{name: "not JSON", body: `operation=add&a=10&b=5`, wantStatus: 400, wantBody: malformed},
		{
			name: "empty body", body: ``,
			wantStatus: 400, wantBody: `{"error":"request body must not be empty"}`,
		},
		{
			name: "array instead of object", body: `[1,2]`,
			wantStatus: 400, wantBody: `{"error":"request body must be a valid JSON object"}`,
		},
		{
			name: "multiple objects", body: `{"operation":"add","a":1,"b":2}{"operation":"add","a":3,"b":4}`,
			wantStatus: 400, wantBody: `{"error":"request body must contain a single JSON object"}`,
		},
		{
			name: "trailing garbage", body: `{"operation":"add","a":1,"b":2}}`,
			wantStatus: 400, wantBody: `{"error":"request body must contain a single JSON object"}`,
		},
	})
}

func TestCalculateMissingFields(t *testing.T) {
	const (
		missingOperation = `{"error":"field \"operation\" is required"}`
		missingA         = `{"error":"field \"a\" is required"}`
		missingB         = `{"error":"field \"b\" is required"}`
	)
	runAPICases(t, []apiCase{
		{name: "operation", body: `{"a":10,"b":5}`, wantStatus: 400, wantBody: missingOperation},
		{name: "empty operation", body: `{"operation":"","a":10,"b":5}`, wantStatus: 400, wantBody: missingOperation},
		{name: "null operation", body: `{"operation":null,"a":10,"b":5}`, wantStatus: 400, wantBody: missingOperation},
		{name: "a", body: `{"operation":"add","b":5}`, wantStatus: 400, wantBody: missingA},
		{name: "null a", body: `{"operation":"add","a":null,"b":5}`, wantStatus: 400, wantBody: missingA},
		{name: "b", body: `{"operation":"add","a":10}`, wantStatus: 400, wantBody: missingB},
		{name: "null b", body: `{"operation":"add","a":10,"b":null}`, wantStatus: 400, wantBody: missingB},
		{name: "a and b", body: `{"operation":"add"}`, wantStatus: 400, wantBody: missingA},
		{name: "all fields", body: `{}`, wantStatus: 400, wantBody: missingOperation},
	})
}

func TestCalculateFieldTypes(t *testing.T) {
	runAPICases(t, []apiCase{
		{
			name: "string operand", body: `{"operation":"add","a":"10","b":5}`,
			wantStatus: 400, wantBody: `{"error":"field \"a\" must be a number"}`,
		},
		{
			name: "boolean operand", body: `{"operation":"add","a":10,"b":true}`,
			wantStatus: 400, wantBody: `{"error":"field \"b\" must be a number"}`,
		},
		{
			name: "object operand", body: `{"operation":"add","a":{},"b":5}`,
			wantStatus: 400, wantBody: `{"error":"field \"a\" must be a number"}`,
		},
		{
			name: "array operand", body: `{"operation":"add","a":10,"b":[5]}`,
			wantStatus: 400, wantBody: `{"error":"field \"b\" must be a number"}`,
		},
		{
			name: "numeric operation", body: `{"operation":1,"a":10,"b":5}`,
			wantStatus: 400, wantBody: `{"error":"field \"operation\" must be a string"}`,
		},
		{
			name: "array operation", body: `{"operation":["add"],"a":10,"b":5}`,
			wantStatus: 400, wantBody: `{"error":"field \"operation\" must be a string"}`,
		},
		{
			name: "operand above float64 range", body: `{"operation":"add","a":1e400,"b":5}`,
			wantStatus: 400, wantBody: `{"error":"field \"a\" is out of range"}`,
		},
		{
			name: "operand below float64 range", body: `{"operation":"add","a":1,"b":-1e400}`,
			wantStatus: 400, wantBody: `{"error":"field \"b\" is out of range"}`,
		},
	})
}

func TestCalculateUnknownAndDuplicateFields(t *testing.T) {
	runAPICases(t, []apiCase{
		{
			name: "unknown field", body: `{"operation":"add","a":10,"b":5,"c":1}`,
			wantStatus: 400, wantBody: `{"error":"request body contains unknown field \"c\""}`,
		},
		{
			name: "first unknown field is reported", body: `{"x":1,"operation":"add","a":10,"b":5,"y":2}`,
			wantStatus: 400, wantBody: `{"error":"request body contains unknown field \"x\""}`,
		},
		{
			name: "uppercase field names", body: `{"OPERATION":"add","A":10,"B":5}`,
			wantStatus: 400, wantBody: `{"error":"request body contains unknown field \"OPERATION\""}`,
		},
		{
			name: "mixed-case field name", body: `{"operation":"add","a":10,"B":5}`,
			wantStatus: 400, wantBody: `{"error":"request body contains unknown field \"B\""}`,
		},
		{
			name: "duplicate operation", body: `{"operation":"add","operation":"divide","a":1,"b":0}`,
			wantStatus: 400, wantBody: `{"error":"request body contains duplicate field \"operation\""}`,
		},
		{
			name: "duplicate operand", body: `{"operation":"add","a":1,"a":2,"b":3}`,
			wantStatus: 400, wantBody: `{"error":"request body contains duplicate field \"a\""}`,
		},
		{
			name: "duplicate null operand", body: `{"operation":"add","a":null,"a":1,"b":3}`,
			wantStatus: 400, wantBody: `{"error":"request body contains duplicate field \"a\""}`,
		},
	})
}

func TestCalculateBodyShape(t *testing.T) {
	const notObject = `{"error":"request body must be a valid JSON object"}`
	runAPICases(t, []apiCase{
		{name: "null", body: `null`, wantStatus: 400, wantBody: notObject},
		{name: "number", body: `42`, wantStatus: 400, wantBody: notObject},
		{name: "string", body: `"add"`, wantStatus: 400, wantBody: notObject},
		{name: "boolean", body: `true`, wantStatus: 400, wantBody: notObject},
		{name: "array", body: `[{"operation":"add","a":1,"b":2}]`, wantStatus: 400, wantBody: notObject},
		{
			name: "whitespace only", body: "  \n\t ",
			wantStatus: 400, wantBody: `{"error":"request body must not be empty"}`,
		},
		{
			name:       "body too large",
			body:       `{"operation":"add","a":10,"b":5,"pad":"` + strings.Repeat("x", 1024) + `"}`,
			wantStatus: 413, wantBody: `{"error":"request body must not exceed 1024 bytes"}`,
		},
		{
			name:       "trailing data too large",
			body:       `{"operation":"add","a":10,"b":5}` + strings.Repeat(" ", 1024) + `{}`,
			wantStatus: 413, wantBody: `{"error":"request body must not exceed 1024 bytes"}`,
		},
	})
}

// TestCalculateValidationOrder pins down which error wins when a request has
// several problems, so clients always get the same, documented error.
func TestCalculateValidationOrder(t *testing.T) {
	runAPICases(t, []apiCase{
		{
			name:        "content type before body",
			contentType: "text/plain", body: `{bad json`,
			wantStatus: 415, wantBody: `{"error":"Content-Type must be application/json"}`,
		},
		{
			name:       "size before unknown field",
			body:       `{"c":"` + strings.Repeat("x", 1024) + `"}`,
			wantStatus: 413, wantBody: `{"error":"request body must not exceed 1024 bytes"}`,
		},
		{
			name:       "early syntax error in oversized body",
			body:       `{bad` + strings.Repeat(" ", 2048),
			wantStatus: 400, wantBody: `{"error":"request body contains malformed JSON"}`,
		},
		{
			name: "malformed JSON before unknown field", body: `{"c":1,"operation":`,
			wantStatus: 400, wantBody: `{"error":"request body contains malformed JSON"}`,
		},
		{
			name: "single object before unknown field", body: `{"c":1}{}`,
			wantStatus: 400, wantBody: `{"error":"request body must contain a single JSON object"}`,
		},
		{
			name: "unknown field before missing fields", body: `{"c":1}`,
			wantStatus: 400, wantBody: `{"error":"request body contains unknown field \"c\""}`,
		},
		{
			name: "unknown field before unsupported operation", body: `{"operation":"pow","a":1,"b":2,"c":3}`,
			wantStatus: 400, wantBody: `{"error":"request body contains unknown field \"c\""}`,
		},
		{
			name: "unsupported operation before missing operands", body: `{"operation":"pow"}`,
			wantStatus: 400,
			wantBody:   `{"error":"unsupported operation \"pow\": must be one of add, subtract, multiply, divide, power, sqrt, percent"}`,
		},
		{
			name: "operation type before operand type", body: `{"operation":1,"a":"x","b":2}`,
			wantStatus: 400, wantBody: `{"error":"field \"operation\" must be a string"}`,
		},
		{
			name: "a before b", body: `{"operation":"add","a":"x"}`,
			wantStatus: 400, wantBody: `{"error":"field \"a\" must be a number"}`,
		},
		{
			name: "validation before division by zero", body: `{"operation":"divide","a":"x","b":0}`,
			wantStatus: 400, wantBody: `{"error":"field \"a\" must be a number"}`,
		},
	})
}

func TestCalculateContentType(t *testing.T) {
	const unsupported = `{"error":"Content-Type must be application/json"}`
	const valid = `{"operation":"add","a":1,"b":2}`
	runAPICases(t, []apiCase{
		{name: "with charset", contentType: "application/json; charset=utf-8", body: valid, wantStatus: 200, wantBody: `{"result":3}`},
		{name: "mixed case", contentType: "Application/JSON", body: valid, wantStatus: 200, wantBody: `{"result":3}`},
		{name: "missing", contentType: "-", body: valid, wantStatus: 415, wantBody: unsupported},
		{name: "text/plain", contentType: "text/plain", body: valid, wantStatus: 415, wantBody: unsupported},
		{name: "form", contentType: "application/x-www-form-urlencoded", body: valid, wantStatus: 415, wantBody: unsupported},
	})
}

func TestCalculateIncorrectMethod(t *testing.T) {
	const want = `{"error":"method not allowed"}`
	ts := newTestServer(t)
	for _, method := range []string{
		http.MethodGet, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions,
	} {
		t.Run(method, func(t *testing.T) {
			res := send(t, ts, method, calculatePath, jsonType, `{"operation":"add","a":1,"b":2}`)

			if res.status != http.StatusMethodNotAllowed {
				t.Errorf("status = %d, want %d", res.status, http.StatusMethodNotAllowed)
			}
			if got := res.header.Get("Allow"); got != http.MethodPost {
				t.Errorf("Allow = %q, want %q", got, http.MethodPost)
			}
			assertJSON(t, res, want)
		})
	}
}

func TestCalculateRequiresVersionedPath(t *testing.T) {
	ts := newTestServer(t)
	for _, path := range []string{"/calculate", "/api/calculate", "/api/v2/calculate"} {
		t.Run(path, func(t *testing.T) {
			res := send(t, ts, http.MethodPost, path, jsonType, `{"operation":"add","a":1,"b":2}`)
			if res.status != http.StatusNotFound {
				t.Errorf("status = %d, want %d", res.status, http.StatusNotFound)
			}
		})
	}
}

func TestAPIUnknownPathNotFound(t *testing.T) {
	ts := newTestServer(t)
	for _, path := range []string{"/api/", "/api/v1/", "/api/v1/nope", "/api/v1/calculate/", "/api/v2/calculate"} {
		t.Run(path, func(t *testing.T) {
			res := send(t, ts, http.MethodPost, path, jsonType, `{"operation":"add","a":1,"b":2}`)
			if res.status != http.StatusNotFound {
				t.Errorf("status = %d, want %d", res.status, http.StatusNotFound)
			}
			assertJSON(t, res, `{"error":"not found"}`)
		})
	}
}
