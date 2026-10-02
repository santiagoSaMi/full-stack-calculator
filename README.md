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
- [Running with Docker](#running-with-docker)
- [Environment variables](#environment-variables)
- [API documentation](#api-documentation)
- [Error handling](#error-handling)
- [Running tests](#running-tests)
- [Generating coverage reports](#generating-coverage-reports)
- [Testing strategy](#testing-strategy)
- [Design rationale](#design-rationale)
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
- A result can start the next calculation (`12 + 3 =` then `× 2 =`). It is carried over at full precision, so `10 ÷ 3 =` then `× 3 =` gives `10`.
- Square root and percentage act on the number shown and can be used inside a calculation (`9 + 16 √ =` gives `13`).
- A loading state while waiting for the API; keys are unavailable, except Clear.
- Clear messages for incomplete input, calculation errors, network failures and an unavailable backend, with the entered numbers kept so the calculation can be corrected and retried.
- Responsive layout from 320 px wide, with light and dark colour schemes that follow the system setting.
- Accessible controls: every key is a labelled button that can be reached and pressed with the keyboard, keyboard focus stays on the key that was pressed while a calculation loads, the result is announced as it changes, and errors are announced as alerts.

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

With Docker, nginx takes the dev server's place: it serves the built frontend and forwards `/api` to the backend container. See [Running with Docker](#running-with-docker).

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

The reasoning behind this structure is in [Design rationale](#design-rationale).

## Repository structure

```
.
├── README.md
├── compose.yaml                  builds and runs both containers
├── contract/                     error cases both test suites check (see Error handling)
├── backend/
│   ├── Dockerfile                multi-stage build: static binary on a minimal base
│   ├── Makefile                  test, coverage and run targets
│   ├── go.mod                    no external dependencies
│   ├── cmd/server/               entry point: port, timeouts, graceful shutdown
│   └── internal/
│       ├── calculator/           arithmetic (no HTTP)
│       └── server/               routes, validation, JSON responses
└── frontend/
    ├── Dockerfile                multi-stage build: Vite build, served by nginx
    ├── nginx/                    nginx configuration template (static files + /api proxy)
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
| Docker with Compose | any recent version | Optional. Only needed for [Running with Docker](#running-with-docker), which needs neither Go nor Node.js installed. |

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

## Running with Docker

Docker runs the application the way it would be deployed: the frontend is built once and served as static files, with no dev server. Neither Go nor Node.js needs to be installed.

From the repository root:

```bash
docker compose up --build
```

Open <http://localhost:3000>. To use another port:

```bash
WEB_PORT=8000 docker compose up --build
```

Stop with `Ctrl+C`, and remove the containers with `docker compose down`. Add `-d` to `up` to run in the background.

### How it fits together

```
Browser ──▶ frontend container (nginx, port 8080 → host port 3000)
               ├─ serves the built static files
               └─ forwards /api/ ──▶ backend container (Go binary, port 8080)
```

| Image | Build | Runtime | Size |
|-------|-------|---------|------|
| `backend` | `golang:1.27-alpine` compiles a static binary. | `gcr.io/distroless/static-debian12:nonroot`: the binary only, with no shell or package manager, running as a non-root user. | about 16 MB |
| `frontend` | `node:22-alpine` runs `npm ci` and `npm run build`. | `nginxinc/nginx-unprivileged:1.29-alpine`: the contents of `dist/` and an nginx configuration, running as a non-root user. | about 82 MB |

Both are multi-stage builds, so compilers, `node_modules` and source code stay out of the final images.

- **One origin.** The browser only talks to nginx, which serves the page and forwards `/api/` to the backend. This is the same arrangement as the Vite proxy in development, so the application code is identical in both and the backend needs no CORS setup.
- **The backend address is a runtime setting.** nginx reads `BACKEND_URL` when the container starts. It is not compiled into the JavaScript bundle, so one frontend image works with any backend address.
- **The backend is looked up as requests arrive**, not once when nginx starts. If the backend container is recreated with a new address, nginx finds it again within about 10 seconds, and the frontend container can start before the backend exists.
- **The backend is not published to the host.** It is reachable only through nginx, on the network Compose creates.
- **The backend's `/health` endpoint is not exposed through nginx**, which forwards only `/api/`.

### Without Compose

```bash
docker build -t calculator-backend ./backend
docker build -t calculator-frontend ./frontend

docker network create calculator
docker run -d --name backend --network calculator calculator-backend
docker run -d --name frontend --network calculator -p 3000:8080 \
  -e BACKEND_URL=http://backend:8080 calculator-frontend
```

`BACKEND_URL` must be a URL the nginx container can reach, with no trailing slash and no path.

### What Compose is not used for

Compose runs the built application. For day-to-day development with hot reload, run the backend and the Vite dev server directly, as described above.

## Environment variables

| Variable | Used by | Default | Purpose |
|----------|---------|---------|---------|
| `PORT` | Backend | `8080` | Port the API listens on. |
| `VITE_API_BASE_URL` | Frontend (build time; a build argument in the frontend image) | empty | Base URL of the API. Empty means the same origin as the page, which is what the dev proxy and the nginx proxy expect. |
| `API_PROXY_TARGET` | Vite dev and preview servers | `http://localhost:8080` | Where `/api` requests are forwarded. Not read by the app itself. |
| `BACKEND_URL` | Frontend container (nginx, at start-up) | `http://backend:8080` | Where nginx forwards `/api/` requests. No trailing slash. |
| `WEB_PORT` | `compose.yaml` | `3000` | Host port the application is published on. |

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
| `{"operation":"divide","a":10,"b":0}` | `422` | `{"error":"division by zero","code":"division_by_zero"}` |
| `{"operation":"sqrt","a":-9}` | `422` | `{"error":"square root of a negative number","code":"negative_square_root"}` |
| `{"operation":"add","a":10}` | `400` | `{"error":"field \"b\" is required","code":"missing_field"}` |
| `{"operation":"sqrt","a":9,"b":2}` | `400` | `{"error":"field \"b\" is not allowed for operation \"sqrt\"","code":"field_not_allowed"}` |
| `{"operation":"modulo","a":10,"b":3}` | `400` | `{"error":"unsupported operation \"modulo\": must be one of add, subtract, multiply, divide, power, sqrt, percent","code":"unsupported_operation"}` |

### Percentage

`percent` has one meaning: it divides a number by 100. `50` gives `0.5`, `250` gives `2.5`, `-50` gives `-0.5`.

- **A percentage of a number** is a multiplication by that result. "10% of 200" is `percent` of `10` (`0.1`), then `multiply` of `200` and `0.1` (`20`). In the calculator: `200 × 10 % =` shows `20`.
- **It does not depend on another operand.** Unlike some pocket calculators, `200 + 10 % =` is `200 + 0.1 = 200.1`, not `220`. To increase a number by 10%, use `200 × 110 % = 220`.
- **It is not a modulo (remainder) operation.**

## Error handling

### API errors

Every error under `/api/` is JSON with two fields:

```json
{ "error": "division by zero", "code": "division_by_zero" }
```

- **`code`** identifies the problem for a program. Codes are part of the API contract: clients should branch on the code and the HTTP status. New codes may be added; existing ones are not renamed.
- **`error`** describes the problem for a developer. Its wording may change.

`400` means the request itself is invalid. `422` means it is well-formed but cannot be computed. Only the first failing check is reported. Checks run in this order: method, content type, body size and JSON syntax, unknown and duplicate fields, then each field in turn, then the calculation itself.

| Status | `code` | When | `error` |
|--------|--------|------|---------|
| `405` | `method_not_allowed` | Method is not `POST` (the response includes `Allow: POST`) | `method not allowed` |
| `415` | `unsupported_media_type` | `Content-Type` is not `application/json` | `Content-Type must be application/json` |
| `413` | `body_too_large` | Body is larger than 1024 bytes | `request body must not exceed 1024 bytes` |
| `400` | `invalid_json` | Body is empty, is not valid JSON, is not a JSON object, or has content after the object | `request body must not be empty` / `request body contains malformed JSON` / `request body must be a valid JSON object` / `request body must contain a single JSON object` |
| `400` | `unknown_field` | A field other than `operation`, `a` and `b` | `request body contains unknown field "<name>"` |
| `400` | `duplicate_field` | A field that appears twice | `request body contains duplicate field "<name>"` |
| `400` | `missing_field` | `operation`, `a` or (for two-operand operations) `b` is missing or `null` | `field "<name>" is required` |
| `400` | `invalid_field_type` | `operation` is not a string, or an operand is not a number | `field "operation" must be a string` / `field "<name>" must be a number` |
| `400` | `unsupported_operation` | `operation` is not one of the supported names | `unsupported operation "<op>": must be one of …` |
| `400` | `field_out_of_range` | An operand is too large for a 64-bit float | `field "<name>" is out of range` |
| `400` | `field_not_allowed` | `b` is sent with a one-operand operation | `field "b" is not allowed for operation "<op>"` |
| `422` | `division_by_zero` | Division by zero, or zero raised to a negative power | `division by zero` |
| `422` | `not_a_real_number` | Negative base raised to a fractional power | `result is not a real number` |
| `422` | `negative_square_root` | Square root of a negative number | `square root of a negative number` |
| `422` | `result_out_of_range` | Result is too large for a 64-bit float | `result is out of range` |
| `404` | `not_found` | Unknown path under `/api/` | `not found` |
| `500` | `internal_error` | Unexpected server failure (details are logged, not returned) | `internal server error` |

Fields are checked one at a time: `operation` first (present, a string, supported), then `a` (present, a number, in range), then `b`. The body size limit and the JSON syntax are checked together as the body is read, so the first of those problems found in the body is the one reported.

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

The specific messages above are chosen from the API's error `code` (`division_by_zero`, `negative_square_root`, `not_a_real_number`, `result_out_of_range`, `field_out_of_range`, `unsupported_operation`), never from its error text. Any other code, and every `5xx`, gets a message chosen by status code alone, so an error the frontend does not know about still gets a sensible message.

`contract/api-errors.json` records this agreement as a list of cases: a request, the status and code the backend must answer with, and the message the frontend must show. Each side's test suite checks its half against the same file, so a change that breaks the agreement fails the tests on the side that made it.

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
| Backend | 92.6% | n/a | n/a | n/a |
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

There is no automated end-to-end test that runs the real frontend against the real backend in a browser. The error contract (`contract/api-errors.json`) covers the part of that gap where the two sides could silently disagree: both test suites check the same error cases.

## Design rationale

Each choice below is explained by what it does in this codebase.

### React + TypeScript

- **React fits the shape of the UI.** The keypad is 21 instances of one `Key` component, and the display is a function of the calculator state. State lives in one reducer (`calculatorReducer.ts`), which React's `useReducer` runs, so the input rules are a plain function that is tested without rendering anything.
- **TypeScript encodes the API contract.** `Operation` is a union of the exact names the API accepts, and a request is a union of two shapes: two-operand requests have `b` and one-operand requests do not. Sending `b` with `sqrt`, or omitting it for `add`, is a compile error.
- **Adding an operation is guided by the compiler.** The operation tables are typed as `Record<BinaryOperation, …>` and `Record<UnaryOperation, …>`, so a new name does not compile until its symbol and label are defined.
- **The calculation status is a discriminated union** (`idle`, `pending`, `success`, `error`), so a result can only be read in the `success` state and an error message only in `error`.
- The project compiles with `strict` and further checks enabled, and uses no `any`. React and React DOM are the only runtime dependencies.

### Go backend

- **The standard library is enough.** `net/http` matches methods and paths (`"POST /api/v1/calculate"`), limits the body size, and shuts down gracefully; `encoding/json` reads the body. The module has no third-party dependencies.
- **Errors are values.** Operations that can fail return an error next to the result (`Divide`, `Power`, `Sqrt`), and the handler checks for specific ones with `errors.Is`. Go's arithmetic would otherwise return `Inf` or `NaN`, which JSON cannot represent.
- **Same number format as the browser.** Go's `float64` and JavaScript's `number` are both IEEE 754 doubles, so operands and results cross the API without conversion or loss.
- **Testing is built in.** `httptest` runs the real handler behind a real HTTP server in the tests, with no extra tooling.

### REST API

- **Plain JSON over HTTP** is what the browser's `fetch` speaks natively and what `curl` can exercise, so the API is usable and testable without a client library.
- **Status codes carry meaning.** `400` is an invalid request and `422` is a valid request that cannot be computed. The frontend relies on this: its message for every server error, and its fallback for any error code it does not recognise, are chosen from the status code alone.
- **One endpoint with an `operation` field**, not one endpoint per operation. A calculation is an action with no stored resource, so it is a `POST`. Power, square root and percentage were each added without a new route.
- **Stateless.** Every request carries everything needed, which is why `percent` is defined as a function of one number and not of a calculation in progress.
- **Versioned path.** `/api/v1` leaves room for an incompatible change later.

### Separation between HTTP handlers and calculator logic

- **`internal/calculator` knows nothing about HTTP.** It imports only `errors` and `math`. Its functions take numbers and return numbers, so they are tested as plain functions with table-driven tests.
- **`internal/server` knows nothing about arithmetic.** It decodes and validates the request, looks the operation up in one table, and translates the outcome: named calculator errors become `422`, anything unexpected becomes a generic `500` whose details are logged and not returned.
- **The table is the only link between them.** Each entry names a calculator function and says whether it takes one operand or two. Adding percentage changed 7 lines in the calculator package and 10 in the handler.

### API service layer in the frontend

- **`fetch` appears in one file**, `services/calculatorApi.ts`. It builds the request, parses the response defensively, and reports any failure as one error type with a kind (`network`, `timeout`, `http`, `invalid_response`).
- **Components and state do not import the service.** `<Calculator>` receives a function of type `(request) => Promise<number>` as a prop; only `App.tsx` imports the API-backed implementation.
- **This made the integration a one-line change.** The UI was first built against a temporary local stand-in. Connecting it to the API replaced that function in `App.tsx`; the reducer and the hook were not modified.
- **It also makes tests simple.** Component tests pass in a fake service and control when it answers, which is how the loading state is tested.

### Automated testing strategy

- **Each layer is tested where its behaviour is visible**: arithmetic as functions, the API through real HTTP requests, state as a reducer, and the UI by pressing keys and reading the display. See [Testing strategy](#testing-strategy).
- **The boundaries are where the mocks go.** The backend tests need no frontend. The frontend tests replace only `fetch` (or the injected service), so everything on the frontend side of the network runs for real.
- **Tests assert exact output**: status codes with complete JSON bodies on the backend, and accessible names and visible text on the frontend. Class names and internal state are never asserted, so restyling or restructuring does not break them.
- **Rule precedence is tested.** When a request has several problems, tests fix which error is reported, so clients see stable behaviour.

### API validation

- **Requests are read field by field, not decoded straight into a struct.** Go's JSON decoder matches field names case-insensitively and lets a repeated field silently overwrite the first. Reading tokens makes names exact and catches duplicates.
- **Mistakes are rejected, not tolerated.** Unknown fields, duplicate fields and a `b` sent with a one-operand operation each return `400`. Ignoring them would return a plausible answer to a request the client did not mean to send.
- **Missing is different from zero.** A missing or `null` operand is an error; it is never treated as `0`.
- **Checks run in a fixed, documented order**, and only the first failure is reported, so the same bad request always gets the same answer.
- **The body is capped at 1024 bytes**, far more than any valid request needs.

### Error handling approach

- **One error shape.** Every error under `/api/` is `{"error": "…", "code": "…"}` with a JSON content type, including `404` and `405`, so a client needs one parser.
- **The API identifies; the frontend decides the wording.** Each API error has a stable `code` for programs and a technical message for developers. The frontend translates every failure in one function (`calculationErrorMessages.ts`), choosing by code and status, and never shows API text or a raw exception.
- **Server errors are judged by status only.** For any `5xx` the response body is ignored, so a failing server can never be shown as a calculation error.
- **Only one error type reaches the screen.** When the service fails, the hook displays its message only if the failure is a `CalculationError`; anything else, such as a bug, gets a generic message.
- **Errors are recoverable.** The entered numbers are kept after a failure, so the user can correct the input or retry, and each request carries an id so a response that arrives after Clear is ignored.

### Why the frontend does not calculate the result

The frontend never computes a result. It sends the operands and shows what the API returns.

- **One source of truth.** The rules of the calculator (what division by zero returns, when a power has no real result, when a result is out of range) are defined once, in Go. Any other client of the API gets identical behaviour.
- **No second implementation to keep in step.** A copy of the arithmetic in TypeScript would have to match the backend in every edge case, and a mismatch would only show up as the UI and the API disagreeing.
- **The same applies to the rules, not only the sums.** The frontend does not check for division by zero or a negative square root. It sends the request and shows the backend's answer.

Two things do happen locally, and neither is arithmetic on the result. Before sending, the frontend checks that the entry is complete and the operands are finite numbers. After receiving, it formats the number for display to 15 significant digits, so `0.30000000000000004` is shown as `0.3`. The rounding is for display only: when a result starts the next calculation, the exact value the API returned is sent, not the rounded text.

The cost is a network round trip per calculation and no offline use. The loading state, the 10-second request timeout and the error messages exist to handle that.

Tests enforce the rule: they make the mocked API answer `2 + 2` with `5` and check that the display shows `5`.

### Other decisions

- **A dev proxy instead of CORS.** The browser calls its own origin and Vite forwards `/api`, so the backend needs no cross-origin configuration for development.
- **One meaning for percent.** `a ÷ 100` in every context, in preference to context-dependent pocket-calculator behaviour. See [Percentage](#percentage).
- **Plain CSS.** No UI framework; one stylesheet per component and shared colour variables.

## Known limitations

- **No keyboard number entry.** The keys can be focused and pressed with the keyboard, but typing digits on the keyboard does not enter them.
- **No calculation history, and no memory keys.**
- **One operation at a time.** Selecting a new operation when both numbers are entered switches the operation; it does not evaluate the pending one first.
- **The Docker setup is a starting point for deployment, not a complete one.** It has no HTTPS, no container health check for the backend (its image has no shell to run one), and no resource limits or orchestration.
- **No CORS support.** The backend sends no CORS headers, so the frontend and the API must be served from one origin, as the dev proxy and the nginx container both arrange.
- **64-bit floating point.** Numbers are IEEE 754 doubles on both sides, so results have about 15 to 17 significant digits. Results are shown rounded to 15 digits but carried into the next calculation exactly, so floating-point effects the display hides can surface later: `0.1 + 0.2 =` shows `0.3`, and `− 0.3 =` then shows `5.55111512312578e-17`, not `0`.
- **No authentication or rate limiting.**
