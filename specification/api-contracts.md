# API Contracts Specification

## Scope
This document defines the canonical server API contracts used to recreate MasteryLS behavior without relying on original source code.

It is aligned to:
- `app.md`
- `domain-model.md`
- `auth-authorization.md`
- `routing-state.md`
- `integrations.md`
- `error-resilience.md`

## Design Goals
- Define stable, machine-derivable request/response contracts.
- Keep authorization server-enforced and deny-by-default.
- Keep observer-mode actor/subject semantics explicit.
- Normalize error shapes across all endpoints.
- Make write flows idempotent and auditable.

## Contract Conventions

### Transport
- Protocol: HTTPS only.
- Media type: `application/json`.
- Versioning: no URL version prefix; canonical paths are unprefixed (for example `/session/observer`).
- Time format: ISO-8601 UTC.
- IDs: UUID strings.
- Execution boundary: endpoints are implemented in server API/edge functions; browser clients do not access operational tables directly.

### Authentication
- Auth mechanism: Supabase bearer token (`Authorization: Bearer <jwt>`).
- Public endpoints explicitly marked; all others require valid auth.
- Server resolves actor identity from token; client cannot supply actor identity.
- OTP request/verification and session refresh are handled directly by Supabase Auth client SDK (provider-managed, not app API endpoints).

### Observer Context
- Observer mode context is server-resolved from active `ObserverSession`.
- Client may pass `observerSessionId` only as a session handle.
- All write endpoints deny in observer mode.

### Idempotency
- Required for non-trivial write operations (`POST`, `PUT`, `PATCH`): `Idempotency-Key` header.
- Duplicate idempotency keys for same actor/endpoint must return same semantic result.

### Resource Orientation
- Prefer resource nouns over verb paths.
- Model state transitions through HTTP method + resource shape (for example `DELETE /session/observer`), not `/stop` suffixes.
- Use nested resources where scope is intrinsic (for example topic attempts under course/topic/interaction).

### Success Response Shape
- Do not wrap successful responses in top-level `data` or `meta`.
- Return the resource object directly for single-resource endpoints.
- Return typed collection objects for list/search endpoints.
- Use `204 No Content` for successful operations with no response body.

Example:
```json
{
  "status": "sent"
}
```

### Error Envelope
```json
{
  "error": {
    "category": "validation",
    "code": "INVALID_TOPIC_ID",
    "message": "topicId must be a UUID",
    "retryable": false,
    "details": {},
    "requestId": "uuid"
  }
}
```

Canonical category and retry semantics are defined in `error-resilience.md`.
Request correlation IDs must also be returned via `X-Request-Id` response header.

## Pagination And Filtering
- Cursor pagination preferred for event/search streams:
  - request: `?limit=50&cursor=<opaque>`
  - response fields: `items`, `nextCursor`, `hasMore`
- Page pagination allowed for compatibility:
  - request: `?page=1&limit=100`
  - response fields: `items`, `page`, `limit`, `totalCount`, `hasMore`
- Filter conventions:
  - repeated query fields or comma-separated values for enums
  - date filters use ISO timestamps (`startDate`, `endDate`)

## Endpoint Groups

## 1) Session Context

Supabase-managed auth flows (outside this API surface):
- OTP request
- OTP verify/session creation
- token refresh/session restore

App API flow below starts after auth session is established.

### `POST /session/observer` (auth)
Request:
```json
{ "observedUserId": "uuid", "contextCourseId": "uuid", "reason": "mentor review" }
```
Response `201`:
```json
{
  "observerSession": {
    "id": "uuid",
    "actorUserId": "uuid",
    "observedUserId": "uuid",
    "assumedByRole": "mentor",
    "startedAt": "..."
  }
}
```

### `DELETE /session/observer` (auth)
Response `204` (active observer session ended for the current actor).

## 2) Catalog, Course, Enrollment

### `GET /courses` (public/auth)
- Returns catalog entries filtered by visibility and effective permissions.

### `GET /courses/{courseId}` (public/auth)
- Returns course metadata contract (`Course`).

### `GET /courses/{courseId}/definition` (public/auth)
- Returns active `CourseDefinition` (modules/topics/interactions metadata).
- Includes `definitionVersion` and `contentVersionMarker`.

### `POST /enrollments` (auth, non-observer)
Request:
```json
{ "courseId": "uuid" }
```
Response `201`: enrollment record.

### `DELETE /enrollments/{enrollmentId}` (auth, non-observer)
Response `204`.

## 3) Topic Content And Learning Runtime

### `GET /courses/{courseId}/topics/{topicId}/content` (public/auth)
Response includes latest revalidated content payload:
```json
{
  "topicId": "uuid",
  "content": "# markdown...",
  "contentRef": {
    "provider": "github",
    "repository": "owner/repo",
    "path": "instruction/topic.md",
    "etag": "W/\"...\"",
    "commitSha": "abcdef..."
  }
}
```

### `POST /courses/{courseId}/topics/{topicId}/interactions/{interactionId}/attempts` (auth, non-observer)
Request:
```json
{
  "type": "multiple_choice",
  "payload": { "selected": [1] }
}
```
Response `201`: immutable `InteractionAttempt`.

### `POST /exam-sessions` (auth, non-observer)
- Starts a new `ExamSession`.

### `POST /exam-sessions/{examSessionId}/submissions` (auth, non-observer)
- Submits an active exam session.

### `POST /courses/{courseId}/topics/{topicId}/notes` (auth, non-observer)
### `PATCH /notes/{noteId}` (auth, non-observer)
- Create/update learner notes.

## 4) Authoring And GitHub Content Operations

### `PUT /courses/{courseId}/topics/{topicId}/content` (editor/root, non-observer)
Request:
```json
{
  "path": "instruction/topic.md",
  "content": "# updated markdown",
  "baseCommitSha": "abcdef...",
  "commitMessage": "Refine mastery prompt guidance"
}
```
Response `200`:
```json
{
  "commitSha": "123abc...",
  "contentVersionMarker": "123abc...",
  "indexing": { "status": "updated", "warning": null }
}
```

### `GET /courses/{courseId}/commits` (editor/root)
### `GET /courses/{courseId}/diff` (editor/root)
- Retrieve commit history and diffs for topic/course paths.

### `POST /courses/{courseId}/search-index-jobs` (editor/root)
- Starts a full search reindex job for a course.

## 5) Course Creation And Export

### `POST /courses` (editor/root, non-observer)
- Create from GitHub template or AI-generated structure.
- Returns created `courseId`, repository details, and provisioning warnings.

### `POST /courses/{courseId}/canvas-export-jobs` (editor/root, non-observer)
### `POST /canvas-export-jobs/{exportJobId}/repairs` (editor/root, non-observer)
- Canvas synchronization operations with structured partial failure details.

## 6) Search, Progress, Metrics

### `GET /search` (public/auth by visibility)
Parameters:
- `courseId` (required)
- `q` (required)
- `limit`, `cursor` (optional)

### `GET /progress` (auth)
- Returns activity/progress records scoped by effective actor/subject permissions.
- Supports filters: `courseId`, `topicId`, `types`, `startDate`, `endDate`, `userId` (privileged only).

### `GET /metrics` (auth)
- Returns aggregated metrics read model.
- Same scope and filtering rules as progress endpoints.

## Authorization Rules By Endpoint Family
- Public read: start/about/catalog/published content only.
- Authenticated learner: self-scoped enrollments, attempts, notes, progress.
- Observer session: read-only only; all write families deny.
- Mentor/editor/root: policy-scoped reads; writes per role matrix in `auth-authorization.md`.

## OpenAPI Derivation Requirement
This document is normative input for generated OpenAPI artifacts.

Generation requirements:
- each endpoint must map to explicit JSON schema for request/response bodies
- each error code must map to standardized error envelope
- each endpoint must declare auth requirement and observer-mode write policy

## Legacy Gaps Addressed
- Replaces implicit service calls with explicit API contracts.
- Normalizes error shape and retryability semantics.
- Enforces observer actor/subject handling as first-class contract behavior.
- Defines idempotent write behavior for conflict-prone operations.
