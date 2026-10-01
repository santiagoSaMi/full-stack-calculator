# Full-Stack Calculator

A full-stack calculator application with a React + TypeScript frontend and a Go backend that performs the calculations through an HTTP API.

## Overview

_TODO: Describe the purpose of the project and its main features._

## Architecture

_TODO: Describe how the frontend and backend are structured and how they communicate._

## Frontend

_TODO: Describe the React + TypeScript client, its structure and tooling._

## Backend

_TODO: Describe the Go service, its structure and responsibilities._

## Testing

_TODO: Describe the testing strategy and how to run the tests for each part._

## Setup

_TODO: Document prerequisites and the steps to install and run the project locally._

## API

All endpoints are served by the Go backend (default port `8080`, configurable with `PORT`).

### `POST /api/v1/calculate`

Request (`Content-Type: application/json`, max 1 KiB):

```json
{ "operation": "add", "a": 10, "b": 5 }
```

| Field       | Type   | Rules                                                          |
|-------------|--------|----------------------------------------------------------------|
| `operation` | string | Required. One of the operations below (lowercase, exact).      |
| `a`         | number | Required. Must fit in a 64-bit float.                          |
| `b`         | number | Required for two-operand operations; must be omitted for one-operand operations. Must fit in a 64-bit float. |

| `operation` | Operands | Result |
|-------------|----------|--------|
| `add`       | `a`, `b` | `a + b` |
| `subtract`  | `a`, `b` | `a − b` |
| `multiply`  | `a`, `b` | `a × b` |
| `divide`    | `a`, `b` | `a ÷ b` |
| `power`     | `a`, `b` | `a` raised to `b`; `0` raised to `0` is `1` |
| `sqrt`      | `a` only | The non-negative square root of `a` |

One-operand operations take only `a`:

```json
{ "operation": "sqrt", "a": 9 }
```

Sending `b` with a one-operand operation is an error rather than being ignored, so a client that sends a second operand by mistake finds out.

Field names are case-sensitive. Unknown and duplicate fields are rejected. `null` is treated as missing.

Success (`200 OK`):

```json
{ "result": 15 }
```

### Errors

Every error under `/api/` is returned as JSON with `Content-Type: application/json`:

```json
{ "error": "division by zero" }
```

The `error` string describes the problem in technical terms. Clients should branch on the HTTP status code and choose their own wording for end users. The bundled frontend never shows this text directly: it translates each failure into a user-facing message in `frontend/src/services/calculationErrorMessages.ts`, using the status code and, for the few cases that deserve specific wording (`division by zero`, `result is not a real number`, `square root of a negative number`, `result is out of range`, `field "<name>" is out of range`, `unsupported operation …`), the exact text below. Changing those texts therefore requires updating that file.

Requests are validated in the order below, and only the **first** failing check is reported. Checks 3–7 run while the body is read, so whichever problem appears first in the body wins (e.g. an oversized body with a syntax error near the start is reported as malformed JSON). Checks 8 onward run only once the whole body has been read and is valid JSON.

| # | Check | Status | `error` message |
|---|-------|--------|-----------------|
| 1 | Method is `POST` | `405` | `method not allowed` (with `Allow: POST`) |
| 2 | `Content-Type` is `application/json` (parameters like `charset` allowed) | `415` | `Content-Type must be application/json` |
| 3 | Body is at most 1024 bytes | `413` | `request body must not exceed 1024 bytes` |
| 4 | Body is not empty | `400` | `request body must not be empty` |
| 5 | Body is valid JSON | `400` | `request body contains malformed JSON` |
| 6 | Body is a JSON object | `400` | `request body must be a valid JSON object` |
| 7 | Body contains exactly one JSON value | `400` | `request body must contain a single JSON object` |
| 8 | No unknown fields (first one in the body is reported) | `400` | `request body contains unknown field "<name>"` |
| 9 | No duplicate fields | `400` | `request body contains duplicate field "<name>"` |
| 10 | `operation` is present and non-empty | `400` | `field "operation" is required` |
| 11 | `operation` is a string | `400` | `field "operation" must be a string` |
| 12 | `operation` is supported | `400` | `unsupported operation "<op>": must be one of add, subtract, multiply, divide, power, sqrt` |
| 13 | `a` is present, then a number, then fits in a 64-bit float | `400` | `field "a" is required` / `field "a" must be a number` / `field "a" is out of range` |
| 14 | Two-operand operations: `b` is present, then a number, then fits in a 64-bit float | `400` | `field "b" is required` / `field "b" must be a number` / `field "b" is out of range` |
| 15 | One-operand operations: `b` is absent | `400` | `field "b" is not allowed for operation "<op>"` |
| 16 | Divisor is not zero (`divide`), and zero is not raised to a negative exponent (`power`) | `422` | `division by zero` |
| 17 | A negative base is not raised to a fractional exponent (`power`) | `422` | `result is not a real number` |
| 18 | Operand is not negative (`sqrt`) | `422` | `square root of a negative number` |
| 19 | Result is finite | `422` | `result is out of range` |

Other responses:

| Situation | Status | `error` message |
|-----------|--------|-----------------|
| Unknown path under `/api/` | `404` | `not found` |
| Unexpected server failure | `500` | `internal server error` |

`400` means the request itself is invalid; `422` means it is well-formed but cannot be computed.

### `GET /health`

Returns `200 OK` with `{ "status": "ok" }`.
