package server_test

import (
	"encoding/json"
	"net/http"
	"os"
	"testing"
)

// contractPath is the error contract shared with the frontend, relative to
// this package. The frontend's tests read the same file.
const contractPath = "../../../contract/api-errors.json"

type errorContract struct {
	Cases []struct {
		Name   string `json:"name"`
		Body   string `json:"body"`
		Status int    `json:"status"`
		Code   string `json:"code"`
	} `json:"cases"`
}

// TestErrorContract checks the backend's half of the contract: each request
// body produces the status and error code the frontend relies on.
func TestErrorContract(t *testing.T) {
	data, err := os.ReadFile(contractPath)
	if err != nil {
		t.Fatalf("read contract: %v", err)
	}
	var contract errorContract
	if err := json.Unmarshal(data, &contract); err != nil {
		t.Fatalf("parse contract: %v", err)
	}
	if len(contract.Cases) == 0 {
		t.Fatal("contract has no cases")
	}

	ts := newTestServer(t)
	for _, tc := range contract.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			res := send(t, ts, http.MethodPost, calculatePath, jsonType, tc.Body)

			if res.status != tc.Status {
				t.Errorf("status = %d, want %d; body = %s", res.status, tc.Status, res.body)
			}
			var body struct {
				Error string `json:"error"`
				Code  string `json:"code"`
			}
			if err := json.Unmarshal(res.body, &body); err != nil {
				t.Fatalf("response is not JSON: %v; body = %s", err, res.body)
			}
			if body.Code != tc.Code {
				t.Errorf("code = %q, want %q", body.Code, tc.Code)
			}
			if body.Error == "" {
				t.Error("error message is empty")
			}
		})
	}
}

// TestEveryErrorHasACode checks that no error response is sent without a
// code, including the ones produced outside the calculate handler.
func TestEveryErrorHasACode(t *testing.T) {
	ts := newTestServer(t)
	requests := []struct {
		name, method, path, contentType, body string
		wantCode                              string
	}{
		{"wrong method", http.MethodGet, calculatePath, "", "", "method_not_allowed"},
		{"unknown API path", http.MethodPost, "/api/v1/unknown", jsonType, "{}", "not_found"},
		{"wrong content type", http.MethodPost, calculatePath, "text/plain", "{}", "unsupported_media_type"},
	}
	for _, tc := range requests {
		t.Run(tc.name, func(t *testing.T) {
			res := send(t, ts, tc.method, tc.path, tc.contentType, tc.body)

			var body struct {
				Code string `json:"code"`
			}
			if err := json.Unmarshal(res.body, &body); err != nil {
				t.Fatalf("response is not JSON: %v; body = %s", err, res.body)
			}
			if body.Code != tc.wantCode {
				t.Errorf("code = %q, want %q", body.Code, tc.wantCode)
			}
		})
	}
}
