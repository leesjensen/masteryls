# Error Handling, Retry, And Resilience Specification

## Scope
This document defines canonical error categories, response mapping, retry/backoff behavior, timeout budgets, and degraded-mode rules.

It is aligned to:
- `api-contracts.md`
- `integrations.md`
- `routing-state.md`
- `architecture-system.md`

## Design Goals
- Consistent error semantics across all boundaries.
- Predictable retry behavior with no unsafe duplicate writes.
- Fast failure for interactive operations.
- Clear degraded-mode behavior under upstream failures.

## Canonical Error Categories
- `auth`: authentication required/invalid session
- `permission`: forbidden by policy
- `validation`: invalid input/schema/transition
- `not_found`: missing entity/resource
- `conflict`: optimistic concurrency or duplicate conflict
- `rate_limit`: provider or API throttling
- `timeout`: operation exceeded configured timeout
- `upstream`: external provider returned error
- `unavailable`: dependency temporarily unavailable
- `internal`: unexpected server failure

## HTTP Mapping
- `401` -> `auth`
- `403` -> `permission`
- `404` -> `not_found`
- `409` -> `conflict`
- `422` -> `validation`
- `429` -> `rate_limit`
- `502` -> `upstream`
- `503` -> `unavailable`
- `504` -> `timeout`
- `500` -> `internal`

## Error Envelope Contract
Every non-2xx response must use:
```json
{
  "error": {
    "category": "conflict",
    "code": "STALE_BASE_COMMIT",
    "message": "Base commit no longer matches current topic version",
    "retryable": true,
    "details": {},
    "requestId": "uuid"
  }
}
```

Rules:
- `message` is safe for user display.
- `details` may include structured remediation hints.
- `retryable` is authoritative for automated retry logic.
- `requestId` must be present in `error.requestId` and echoed in `X-Request-Id` response header.

## Retry Policy Matrix

| Operation family | Default retry | Max attempts | Backoff | Notes |
|---|---:|---:|---|---|
| Public/auth reads | yes on transient (`timeout`,`upstream`,`unavailable`,`rate_limit`) | 3 | exponential + jitter | no retry on `validation`,`permission`,`not_found` |
| Protected reads | yes on transient | 3 | exponential + jitter | observer mode does not change read retry policy |
| Idempotent writes with key | yes on transient/conflict-safe | 3 | exponential + jitter | requires `Idempotency-Key` |
| Non-idempotent writes without key | no automatic retry | 1 | n/a | caller must explicitly resubmit |
| AI discussion/feedback | limited | 2 | short exponential | fallback UX on final failure |
| Canvas export/repair/reindex | yes | 5 | capped exponential | tracked via `integration_job_run` |

Backoff recommendation:
- base: 250ms
- multiplier: 2
- jitter: 0-20%
- max sleep: 8s

## Timeout Budgets
- Auth endpoints: 5s
- Standard reads/writes: 10s
- Topic content load from integration boundary: 12s
- AI discussion/feedback: 10s
- AI generation (bulk): 45s
- Canvas export/repair operations: 120s (async job preferred)
- Reindex: 120s (async job preferred)

## Conflict Handling Rules
- Content write conflicts (`409`) must return current version marker and merge guidance.
- Client must not silently overwrite on conflict.
- Recovery path:
  1. reload latest content/version
  2. reapply change
  3. retry with new base marker

## Degraded Mode Rules
- If GitHub reads fail: show structured topic load error and retry action.
- If incremental search indexing fails post-commit: commit still succeeds with warning.
- If AI fails during optional enhancement: keep primary workflow available with fallback.
- If Canvas export partially fails: return partial-failure summary with retryable subset.

## UX Error-State Requirements
Primary routes (`/dashboard`, `/course/*`, `/metrics`, `/progress`, `/courseCreation`, `/courseExport`) must each define:
- `loading`
- `empty`
- `error`
- `retry action`

Error routes in `routing-state.md` remain canonical for typed status rendering (`401`, `403`, `404`, `409`, `422`, `500`).

## Observability Requirements
On any error:
- emit request-scoped log with `requestId`, `category`, `code`, latency, actor/subject ids
- emit `ActivityEvent` for denied privileged operations
- for integration failures, record provider and operation name

## Circuit Breaker Guidance
For unstable upstream providers (GitHub, Gemini, Canvas):
- open breaker on repeated transient failures
- short-circuit requests while open with `unavailable`
- probe half-open with limited trial requests
- close after healthy response window

## Legacy Gaps Addressed
- Removes ad hoc error strings and inconsistent handling.
- Defines retry safety boundaries and idempotency requirements.
- Makes timeout/degraded behavior explicit for generation and operations.
