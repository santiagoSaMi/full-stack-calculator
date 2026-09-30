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
| `operation` | string | Required. One of `add`, `subtract`, `multiply`, `divide` (lowercase, exact). |
| `a`         | number | Required. Must fit in a 64-bit float.                          |
| `b`         | number | Required. Must fit in a 64-bit float.                          |

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

The `error` string is meant for display and debugging; clients should branch on the HTTP status code.

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
| 12 | `operation` is supported | `400` | `unsupported operation "<op>": must be one of add, subtract, multiply, divide` |
| 13 | `a`, then `b`, is present | `400` | `field "<name>" is required` |
| 14 | `a`, then `b`, is a number | `400` | `field "<name>" must be a number` |
| 15 | `a`, then `b`, fits in a 64-bit float | `400` | `field "<name>" is out of range` |
| 16 | Divisor is not zero | `422` | `division by zero` |
| 17 | Result is finite | `422` | `result is out of range` |

Other responses:

| Situation | Status | `error` message |
|-----------|--------|-----------------|
| Unknown path under `/api/` | `404` | `not found` |
| Unexpected server failure | `500` | `internal server error` |

`400` means the request itself is invalid; `422` means it is well-formed but cannot be computed.

### `GET /health`

Returns `200 OK` with `{ "status": "ok" }`.
