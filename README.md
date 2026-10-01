# Full-Stack Calculator

A calculator with a React + TypeScript frontend and a Go backend. The frontend handles input and display; every result is computed by the backend through a small, versioned REST API.

## Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Running the backend](#running-the-backend)
- [Running the frontend](#running-the-frontend)
- [Environment variables](#environment-variables)
- [API documentation](#api-documentation)
- [Error handling](#error-handling)
- [Running tests](#running-tests)
- [Generating coverage reports](#generating-coverage-reports)
- [Testing strategy](#testing-strategy)
- [Design decisions](#design-decisions)
- [Known limitations](#known-limitations)

## Overview

The project has two independent parts:

- **`backend/`**: a Go HTTP service, built on the standard library only, that validates requests and performs the arithmetic.
- **`frontend/`**: a React single-page app, built with Vite, that collects input, calls the API and shows the result or a clear error.

The two communicate over one endpoint, `POST /api/v1/calculate`.

## Features

**Calculator**

- Addition, subtraction, multiplication, division, exponentiation, square root and percentage.
- Decimal and negative numbers, up to 15 digits per number.
- A result can start the next calculation (`12 + 3 =` then `× 2 =`).
- Square root and percentage act on the number shown and can be used inside a calculation (`9 + 16 √ =` gives `13`).
- A loading state while waiting for the API; keys are disabled, except Clear.
- Clear messages for incomplete input, calculation errors, network failures and an unavailable backend, with the entered numbers kept so the calculation can be corrected and retried.
- Responsive layout from 320 px wide, with light and dark colour schemes that follow the system setting.
- Accessible controls: every key is a labelled button that can be reached and pressed with the keyboard, the result is announced as it changes, and errors are announced as alerts.

**API**

- One versioned JSON endpoint for all operations, and a health check.
- Strict request validation with a consistent JSON error format and predictable status codes.
- Request size limit, server timeouts and graceful shutdown.

## Architecture

```
Browser (React app)
   │  POST /api/v1/calculate   (same origin)
   ▼
Vite dev server ── proxies /api ──▶ Go backend (:8080)
```

In development the browser only talks to the Vite dev server, which forwards `/api` requests to the backend. Requests therefore stay same-origin and the backend needs no CORS configuration.

**Backend layers**

| Package | Responsibility |
|---------|----------------|
| `internal/calculator` | The arithmetic: pure functions with no knowledge of HTTP. |
| `internal/server` | Routing, request decoding and validation, mapping errors to status codes, JSON responses. |
| `cmd/server` | Process start-up: port, timeouts, graceful shutdown. |

**Frontend layers**

| Folder | Responsibility |
|--------|----------------|
| `src/calculator` | Calculator state: a pure reducer, input validation, and the `useCalculator` hook. No HTTP. |
| `src/services` | The API client (`fetch`), and the translation of failures into user-facing messages. |
| `src/components` | Presentational components (`Calculator`, `Display`, `Keypad`, `Key`). No HTTP and no arithmetic. |

`App.tsx` connects the layers by passing the API-backed service to `<Calculator>`. The calculator state depends only on a function type, `(request) => Promise<number>`, not on the API client.

### Why the backend performs the arithmetic

The frontend never computes a result. It sends the operands and shows what the API returns.

- **One source of truth.** The rules of the calculator (what division by zero returns, when a power has no real result, when a result is out of range) are defined once. Any other client of the API gets identical behaviour.
- **No duplicated logic to drift apart.** Two implementations of the same arithmetic would have to be kept in step, and a mismatch would only show up as the UI and the API disagreeing.
- **Clear responsibilities.** The frontend owns input and presentation; the backend owns the calculation. Each can be tested on its own.

The frontend still does two things locally, neither of which is arithmetic on the result: it checks that the entry is complete and that the operands are finite numbers before sending them, and it formats the returned number for display (to 15 significant digits, so `0.30000000000000004` is shown as `0.3`).

The cost is a network round trip per calculation, and no offline use. The loading state, request timeout and error messages exist to handle that. A test enforces the rule: it makes the mocked API answer `2 + 2` with `5` and checks that the display shows `5`.

## Repository structure

```
.
├── README.md
├── backend/
│   ├── Makefile                  test, coverage and run targets
│   ├── go.mod                    no external dependencies
│   ├── cmd/server/               entry point: port, timeouts, graceful shutdown
│   └── internal/
│       ├── calculator/           arithmetic (no HTTP)
│       └── server/               routes, validation, JSON responses
└── frontend/
    ├── .env.example              documents the environment variables
    ├── package.json
    ├── vite.config.ts            dev proxy and test coverage configuration
    └── src/
        ├── main.tsx, App.tsx     entry point and composition
        ├── calculator/           state reducer, validation, hook, types
        ├── services/             API client and error-message translation
        ├── components/           Calculator, Display, Keypad, Key
        ├── types/                API request and response types
        └── test/                 shared test helpers
```

Tests sit next to the code they test (`*_test.go`, `*.test.ts`, `*.test.tsx`).

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Go | 1.27.1 or later | As declared in `backend/go.mod`. |
| Node.js | 22.22 or later in the 22.x line, or 24.15 or later | The range the test tooling supports; includes npm. |
| make | any | Optional. Only used for the backend shortcuts; the plain `go` commands are listed too. |

## Local setup

```bash
git clone <repository-url>
cd full-stack-calculator

cd frontend
npm install
```

The backend has no dependencies to install.

## Running the backend

From `backend/`:

```bash
go run ./cmd/server        # or: make run
```

The server listens on port `8080` and logs `server listening on :8080`. To use another port:

```bash
PORT=9000 go run ./cmd/server
```

Check that it is running:

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

Stop it with `Ctrl+C`. In-flight requests are given up to 10 seconds to finish.

## Running the frontend

Start the backend first, then from `frontend/`:

```bash
npm run dev
```

Open <http://localhost:5173>. The dev server forwards `/api` requests to `http://localhost:8080`. If the backend runs elsewhere, point the proxy at it:

```bash
API_PROXY_TARGET=http://localhost:9000 npm run dev
```

Stop it with `Ctrl+C`.

Other commands:

| Command | What it does |
|---------|--------------|
| `npm run build` | Type-checks and writes a production build to `dist/`. |
| `npm run preview` | Serves the production build locally, with the same `/api` proxy. |
| `npm run typecheck` | Type-checks the project, including the tests. |
| `npm run lint` | Lints the project with oxlint. |

## Environment variables

| Variable | Used by | Default | Purpose |
|----------|---------|---------|---------|
| `PORT` | Backend | `8080` | Port the API listens on. |
| `VITE_API_BASE_URL` | Frontend (build time) | empty | Base URL of the API. Empty means the same origin as the page, which is what the dev proxy expects. |
| `API_PROXY_TARGET` | Vite dev and preview servers | `http://localhost:8080` | Where `/api` requests are forwarded. Not read by the app itself. |

`frontend/.env.example` documents the frontend variables. No variable is required for local development.

Setting `VITE_API_BASE_URL` to a different origin also requires the backend to allow cross-origin requests, which it does not currently do (see [Known limitations](#known-limitations)).

## API documentation

Base URL: `http://localhost:8080`. All request and response bodies are JSON.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/calculate` | Perform a calculation. |
| `GET` | `/health` | Liveness check; returns `{"status":"ok"}`. |

### `POST /api/v1/calculate`

Requests must send `Content-Type: application/json` and a body of at most 1024 bytes.

| Field | Type | Rules |
|-------|------|-------|
| `operation` | string | Required. One of the names below, lowercase. |
| `a` | number | Required. |
| `b` | number | Required for two-operand operations. Must be omitted for one-operand operations. |

Field names are case-sensitive. Unknown and duplicate fields are rejected, and `null` counts as missing.

| `operation` | Operands | Result |
|-------------|----------|--------|
| `add` | `a`, `b` | `a + b` |
| `subtract` | `a`, `b` | `a − b` |
| `multiply` | `a`, `b` | `a × b` |
| `divide` | `a`, `b` | `a ÷ b` |
| `power` | `a`, `b` | `a` raised to `b`. `0` raised to `0` is `1`. |
| `sqrt` | `a` | The non-negative square root of `a`. |
| `percent` | `a` | `a ÷ 100`: `a` percent as a plain number. |

A successful response is `200 OK` with the result:

```json
{ "result": 15 }
```

### Examples

```bash
curl -X POST http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","a":10,"b":5}'
# {"result":15}
```

| Request body | Status | Response body |
|--------------|--------|---------------|
| `{"operation":"add","a":10,"b":5}` | `200` | `{"result":15}` |
| `{"operation":"subtract","a":10,"b":5}` | `200` | `{"result":5}` |
| `{"operation":"multiply","a":10,"b":5}` | `200` | `{"result":50}` |
| `{"operation":"divide","a":10,"b":4}` | `200` | `{"result":2.5}` |
| `{"operation":"power","a":2,"b":10}` | `200` | `{"result":1024}` |
| `{"operation":"sqrt","a":9}` | `200` | `{"result":3}` |
| `{"operation":"percent","a":50}` | `200` | `{"result":0.5}` |
| `{"operation":"divide","a":10,"b":0}` | `422` | `{"error":"division by zero"}` |
| `{"operation":"sqrt","a":-9}` | `422` | `{"error":"square root of a negative number"}` |
| `{"operation":"add","a":10}` | `400` | `{"error":"field \"b\" is required"}` |
| `{"operation":"sqrt","a":9,"b":2}` | `400` | `{"error":"field \"b\" is not allowed for operation \"sqrt\""}` |
| `{"operation":"modulo","a":10,"b":3}` | `400` | `{"error":"unsupported operation \"modulo\": must be one of add, subtract, multiply, divide, power, sqrt, percent"}` |

### Percentage

`percent` has one meaning: it divides a number by 100. `50` gives `0.5`, `250` gives `2.5`, `-50` gives `-0.5`.

- **A percentage of a number** is a multiplication by that result. "10% of 200" is `percent` of `10` (`0.1`), then `multiply` of `200` and `0.1` (`20`). In the calculator: `200 × 10 % =` shows `20`.
- **It does not depend on another operand.** Unlike some pocket calculators, `200 + 10 % =` is `200 + 0.1 = 200.1`, not `220`. To increase a number by 10%, use `200 × 110 % = 220`.
- **It is not a modulo (remainder) operation.**

## Error handling

### API errors

Every error under `/api/` is JSON with one field:

```json
{ "error": "division by zero" }
```

`400` means the request itself is invalid. `422` means it is well-formed but cannot be computed. Only the first failing check is reported; the rows from `405` down to the last `422` are listed in the order the checks run.

| Status | When | `error` |
|--------|------|---------|
| `405` | Method is not `POST` (the response includes `Allow: POST`) | `method not allowed` |
| `415` | `Content-Type` is not `application/json` | `Content-Type must be application/json` |
| `413` | Body is larger than 1024 bytes | `request body must not exceed 1024 bytes` |
| `400` | Body is empty | `request body must not be empty` |
| `400` | Body is not valid JSON | `request body contains malformed JSON` |
| `400` | Body is not a JSON object | `request body must be a valid JSON object` |
| `400` | Body has content after the object | `request body must contain a single JSON object` |
| `400` | Unknown or duplicate field | `request body contains unknown field "<name>"` / `request body contains duplicate field "<name>"` |
| `400` | `operation` is missing, not a string, or not supported | `field "operation" is required` / `field "operation" must be a string` / `unsupported operation "<op>": must be one of …` |
| `400` | `a` is missing, not a number, or too large for a 64-bit float | `field "a" is required` / `field "a" must be a number` / `field "a" is out of range` |
| `400` | The same checks for `b`, for two-operand operations | `field "b" is required` / `field "b" must be a number` / `field "b" is out of range` |
| `400` | `b` is sent with a one-operand operation | `field "b" is not allowed for operation "<op>"` |
| `422` | Division by zero, or zero raised to a negative power | `division by zero` |
| `422` | Negative base raised to a fractional power | `result is not a real number` |
| `422` | Square root of a negative number | `square root of a negative number` |
| `422` | Result is too large for a 64-bit float | `result is out of range` |
| `404` | Unknown path under `/api/` | `not found` |
| `500` | Unexpected server failure (details are logged, not returned) | `internal server error` |

The body size limit and the JSON syntax are checked together as the body is read, so the first of those problems found in the body is the one reported.

### Errors in the frontend

The frontend never shows the API's `error` text or a raw technical error. Every failure is translated into a message for the user in one place, `frontend/src/services/calculationErrorMessages.ts`, mainly from the status code.

| Situation | Message shown |
|-----------|---------------|
| `=` pressed with no operation chosen | Choose an operation first. |
| `=` pressed with no second number | Enter a second number. |
| A number that is not finite | Enter a valid number. |
| Division by zero | Cannot divide by zero. |
| Square root of a negative number | Cannot take the square root of a negative number. |
| Power with no real result | That calculation has no real-number result. |
| Result out of range | The result is too large to calculate. |
| A number too large for the API | That number is too large. |
| Operation the API does not support | That operation is not supported. |
| Any other `422` | That calculation cannot be performed. |
| Other invalid request (`400`, `413`, `415`) | The calculation could not be processed. Check your input and try again. |
| No response from the server | Could not reach the calculator service. Check your connection. |
| No response within 10 seconds | The calculator service took too long to respond. Please try again. |
| `502`, `503` or `504` | The calculator service is unavailable. Please try again later. |
| Other server error | The calculator service had a problem. Please try again. |
| Anything unexpected | Something went wrong. Please try again. |

The first three are checked in the frontend before anything is sent. The calculation rules (division by zero, negative square roots and so on) are not checked in the frontend: the request is sent and the backend decides.

A few API error texts are matched to give the specific messages above: `division by zero`, `square root of a negative number`, `result is not a real number`, `result is out of range`, `field "a" is out of range` (and the same for `b`), and any text starting with `unsupported operation`. Changing those texts in the backend requires updating that file. Any other error, and every `5xx`, gets a message chosen by status code alone.

## Running tests

Neither test suite needs the other part running. The backend tests start their own in-process HTTP server, and the frontend tests replace `fetch`, so no test makes a real network request.

**Backend**, from `backend/`:

```bash
make test            # or: go test ./...
go test -race ./...  # with the race detector
```

**Frontend**, from `frontend/`:

```bash
npm run test         # run once
npm run test:watch   # rerun on change
```

## Generating coverage reports

**Backend**, from `backend/`:

| Command | Output |
|---------|--------|
| `make cover` | Coverage per function and in total, printed in the terminal. |
| `make cover-html` | The same, plus `coverage.html` showing covered and uncovered lines. |
| `make clean` | Removes the generated coverage files. |

Without `make`:

```bash
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
go tool cover -html=coverage.out -o coverage.html
```

**Frontend**, from `frontend/`:

```bash
npm run test:coverage
```

This prints a coverage table and writes an HTML report to `coverage/index.html`. The command fails if statements, branches, functions or lines fall below 95%. Coverage is measured over every file in `src/` except the tests, the test helpers in `src/test/` and type declarations.

**Current results**

| | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Backend | 92.5% | n/a | n/a | n/a |
| Frontend | 100% | 99.4% | 100% | 100% |

Go's coverage tool reports statements only. By package: `internal/calculator` 100%, `internal/server` 100%, `cmd/server` 58.8%.

Two things are deliberately not covered:

- **Backend `main()`**: it only wires the pieces together (signal handling, opening the port, `log.Fatal`) and can only run as a real process. The functions it calls are at 100%.
- **One defensive branch in the frontend** (the last fallback in `selectDisplayValue`): it guards a state the reducer cannot produce.

## Testing strategy

Each layer is tested at the level where its behaviour is visible.

**Backend**

| Layer | Approach |
|-------|----------|
| `internal/calculator` | Table-driven unit tests for every operation: positive, negative, zero and decimal values, and every error case. |
| `internal/server` | API tests through a real HTTP server and client (`httptest.NewServer`). They check the status code and the exact JSON body for each operation and each validation rule, including which error wins when a request has several problems. |
| `cmd/server` | The port setting, the server timeouts, and graceful shutdown, including that a request in flight finishes before the server stops. |

**Frontend**

| Layer | Approach |
|-------|----------|
| `src/calculator` | Unit tests of the reducer and validation as plain functions, and of the hook's guards. |
| `src/services` | The API client with `fetch` mocked: the request sent, response parsing, and every failure kind. The error-message translation is tested rule by rule. |
| `src/components` | Component tests with Testing Library and a fake calculation service. They press keys by their accessible names and read the display, so they do not depend on class names or internal state. |
| `src/App.tsx` | The whole frontend with only `fetch` mocked, checking the request the browser would send and what the user sees for each kind of response. |

Principles followed:

- Tests describe observable behaviour, not implementation details.
- Domain tests and HTTP tests are kept separate on both sides.
- No test makes a real network request.
- Coverage is a by-product, not a target: no test exists only to execute a line.

There is no automated end-to-end test that runs the real frontend against the real backend in a browser.

## Design decisions

- **The backend is the only place arithmetic happens.** See [Why the backend performs the arithmetic](#why-the-backend-performs-the-arithmetic).
- **Standard library only in the backend.** Go's `net/http` router handles method and path matching, so no framework is needed. The backend has no third-party dependencies.
- **The arithmetic is independent of HTTP.** `internal/calculator` has plain functions that return named errors (`ErrDivisionByZero` and others). The HTTP layer decides how those become status codes.
- **Strict validation.** Unknown fields, duplicate fields, wrong-case field names and an extra `b` on a one-operand operation are rejected, not ignored, so client mistakes surface instead of producing a plausible wrong answer.
- **`400` versus `422`.** An invalid request and a valid request that cannot be computed are different problems, and clients can tell them apart by status code alone.
- **One table defines the operations.** Each operation declares whether it takes one operand or two, and validation reads that table. Adding an operation does not add special cases.
- **A versioned path.** `/api/v1` leaves room for incompatible changes later.
- **Frontend state is a pure reducer.** All input rules live in one function with no React and no side effects. The hook is the only place that calls the service.
- **The service is passed in, not imported.** `<Calculator>` receives the calculation function as a prop, which keeps components free of HTTP and makes them simple to test.
- **Late responses are ignored.** Each request carries an id, so a response that arrives after Clear cannot overwrite the display.
- **A dev proxy instead of CORS.** The browser calls its own origin and Vite forwards `/api`, so the backend needs no cross-origin configuration for development.
- **One meaning for percent.** `a ÷ 100` in every context, documented above, in preference to context-dependent pocket-calculator behaviour.
- **Plain CSS.** No UI framework; one stylesheet per component and shared colour variables.

## Known limitations

- **No keyboard number entry.** The keys can be focused and pressed with the keyboard, but typing digits on the keyboard does not enter them.
- **No calculation history, and no memory keys.**
- **One operation at a time.** Selecting a new operation when both numbers are entered switches the operation; it does not evaluate the pending one first.
- **No production deployment setup.** The `/api` proxy exists only in Vite's dev and preview servers, the backend does not serve the frontend, and it sends no CORS headers. Deploying needs a reverse proxy that serves both under one origin, or CORS support in the backend.
- **64-bit floating point.** Numbers are IEEE 754 doubles on both sides, so results have about 15 to 17 significant digits.
- **No authentication or rate limiting.**
