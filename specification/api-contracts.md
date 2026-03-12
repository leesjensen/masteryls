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
- `policy-defaults.md`

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

### Query Parameter Naming
Canonical query field names:
- text query: `query`
- multi-value event filter: `eventTypes`
- date bounds: `startAt`, `endAt`
- pagination: `limit`, `cursor` (or `page` for compatibility)

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
  - date filters use ISO timestamps (`startAt`, `endAt`)

## Endpoint Groups

## 1) Session And Identity

Supabase-managed auth flows (outside this API surface):
- OTP request
- OTP verify/session creation
- token refresh/session restore

App API flow below starts after auth session is established.

### `GET /session` (auth)
Purpose: bootstrap app session/profile/role context.

Response `200`:
```json
{
  "sessionStatus": "authenticated",
  "user": {
    "id": "uuid",
    "email": "learner@example.edu",
    "displayName": "Learner Name"
  },
  "effectiveRoles": [
    {
      "id": "uuid",
      "role": "learner",
      "scopeType": "global",
      "scopeId": null
    }
  ],
  "observerSession": null,
  "capabilities": {
    "canCreateCourse": false,
    "canViewMetrics": true
  }
}
```

### `POST /session/observer` (auth)
Request schema: `ObserverSessionStartRequest`
```json
{ "observedUserId": "uuid", "contextCourseId": "uuid", "reason": "mentor review" }
```
Response `201` schema: `ObserverSessionResource`
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

### `GET /users` (auth, privileged)
Purpose: bounded user search for role/delegation management.

Parameters:
- `query` (required, min length from policy defaults)
- `limit`, `cursor`

Response `200` schema: `UserSearchResult`
```json
{
  "items": [
    { "id": "uuid", "email": "user@example.edu", "displayName": "User Name" }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

## 2) Dashboard, Catalog, Course, Enrollment

### `GET /dashboard` (auth)
Purpose: single read-model endpoint for dashboard load.

Parameters:
- optional `query` (discoverable search)
- optional `includeCompleted` (`true|false`)
- optional `cursor`

Response `200` schema: `DashboardViewResource`
```json
{
  "summary": {
    "activeEnrollmentCount": 2,
    "completedEnrollmentCount": 1,
    "discoverableCourseCount": 3
  },
  "enrolledCourses": [],
  "discoverableCourses": [],
  "nextCursor": null,
  "hasMore": false
}
```

### `GET /courses` (public/auth)
- Returns catalog entries filtered by visibility and effective permissions.

### `POST /courses` (editor/root, non-observer)
- Create from GitHub template or AI-generated structure.
- Request requires `creationMode`, repository target, and metadata.
- Response returns created course metadata and provisioning summary.

### `GET /courses/{courseId}` (public/auth)
- Returns course metadata contract (`Course`).

### `PATCH /courses/{courseId}` (editor/root, non-observer)
Purpose: update course settings metadata.

Request schema: `CoursePatchRequest`
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "state": "published",
  "visibility": "authenticated",
  "deleteProtected": true,
  "externalRefs": { "canvasCourseId": "12345" }
}
```

Response `200`: updated course metadata resource.

### `DELETE /courses/{courseId}` (root, non-observer)
Parameters:
- optional `deleteRepository` (`true|false`, default from policy defaults)

Response `204`.

### `GET /courses/{courseId}/definition` (public/auth)
- Returns active `CourseDefinition` (modules/topics/interactions metadata).
- Includes `definitionVersion` and `contentVersionMarker`.

### `PUT /courses/{courseId}/definition` (editor/root, non-observer)
Purpose: canonical structure commit (`course.json`).

Request schema: `CourseDefinitionWriteRequest`
```json
{
  "definition": {},
  "baseCommitSha": "abcdef...",
  "commitMessage": "Update module order"
}
```

Response `200` schema: `CourseDefinitionWriteResult`
```json
{
  "definitionVersion": 12,
  "commitSha": "123abc...",
  "contentVersionMarker": "123abc...",
  "indexing": { "status": "updated", "warning": null }
}
```

### `POST /enrollments` (auth, non-observer)
Request:
```json
{ "courseId": "uuid" }
```
Response `201`: enrollment record.

### `DELETE /enrollments/{enrollmentId}` (auth, non-observer)
Response `204`.

## 3) Topic Content, Discussion, Notes, And Learning Runtime

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
Request:
```json
{ "courseId": "uuid", "topicId": "uuid", "enrollmentId": "uuid" }
```
Response `201`: `ExamSession`.

### `GET /exam-sessions/{examSessionId}` (auth)
- Returns current exam session state for authorized subject context.

### `POST /exam-sessions/{examSessionId}/submissions` (auth, non-observer)
Request:
```json
{ "answers": [{ "interactionId": "uuid", "payload": {} }] }
```
Response `200`: submitted/graded exam summary.

### `GET /courses/{courseId}/topics/{topicId}/notes` (auth)
Parameters:
- optional `sectionKey`
- optional `limit`, `cursor`

Response `200` schema: `NoteListResult`.

### `POST /courses/{courseId}/topics/{topicId}/notes` (auth, non-observer)
### `PATCH /notes/{noteId}` (auth, non-observer)
### `DELETE /notes/{noteId}` (auth, non-observer)
- Create/update/delete learner notes.

### `POST /courses/{courseId}/topics/{topicId}/discussion/messages` (auth, non-observer)
Purpose: AI discussion reply generation with server-built context.

Request schema: `DiscussionMessageRequest`
```json
{
  "message": "Can you explain this section in simpler terms?",
  "activeSection": "event-loop",
  "conversationMessages": [
    { "role": "user", "content": "What is event loop?" },
    { "role": "model", "content": "..." }
  ]
}
```

Response `200` schema: `DiscussionMessageResult`
```json
{
  "reply": {
    "role": "model",
    "content": "..."
  },
  "contextWindow": {
    "messageCountUsed": 8,
    "notesIncluded": 2
  }
}
```

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

### `POST /courses/{courseId}/topics/{topicId}/ai-commit-message` (editor/root, non-observer)
Request:
```json
{
  "path": "instruction/topic.md",
  "baseCommitSha": "abcdef...",
  "proposedContent": "# updated markdown"
}
```
Response `200`:
```json
{
  "suggestedMessage": "Clarify loop scheduling example",
  "generated": true,
  "timedOut": false
}
```

### `GET /courses/{courseId}/commits` (editor/root)
Parameters:
- required `path`
- optional `limit`, `cursor`

Response `200`: commit history page.

### `GET /courses/{courseId}/diff` (editor/root)
Parameters:
- required `path`
- optional `baseSha`, `headSha`

Response `200`: unified or split diff payload.

### `GET /courses/{courseId}/topics/{topicId}/files` (editor/root)
### `POST /courses/{courseId}/topics/{topicId}/files` (editor/root, non-observer)
### `DELETE /courses/{courseId}/topics/{topicId}/files/{filePath}` (editor/root, non-observer)
- File list/upload/delete for topic-adjacent assets.

## 5) Admin, Permissions, And Maintenance

### `GET /courses/{courseId}/role-assignments` (editor/root)
- Returns active course-scoped role assignments.

### `POST /courses/{courseId}/role-assignments` (editor/root, non-observer)
Request:
```json
{ "userId": "uuid", "role": "mentor" }
```
Response `201`: created `RoleAssignment`.

### `DELETE /role-assignments/{roleAssignmentId}` (editor/root, non-observer)
Response `204`.

### `GET /observer-delegations` (auth, privileged)
Parameters:
- optional `observerUserId`
- optional `observedUserId`

### `POST /observer-delegations` (auth, privileged, non-observer)
Request:
```json
{ "observerUserId": "uuid", "observedUserId": "uuid" }
```
Response `201`: created `ObserverDelegation`.

### `DELETE /observer-delegations/{observerDelegationId}` (auth, privileged, non-observer)
Response `204`.

### `POST /courses/{courseId}/search-reindex-jobs` (editor/root, non-observer)
### `POST /courses/{courseId}/content-refresh-jobs` (editor/root, non-observer)
- Starts maintenance job runs.

### `GET /jobs/{jobId}` (auth)
- Returns standardized job status for export/reindex/refresh operations.

## 6) Canvas Export

### `POST /courses/{courseId}/canvas-export-jobs` (editor/root, non-observer)
- Starts full or incremental export.

### `POST /canvas-export-jobs/{exportJobId}/repairs` (editor/root, non-observer)
- Starts mapping repair workflow for completed export scope.

## 7) Search, Progress, Metrics

### `GET /search` (public/auth by visibility)
Parameters:
- `courseId` (required)
- `query` (required)
- `limit`, `cursor` (optional)

Response `200`:
```json
{
  "query": "event loop",
  "matches": [
    {
      "topicId": "uuid",
      "topicTitle": "Asynchronous JavaScript",
      "headlines": ["..."],
      "rank": 0.92
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

### `GET /progress` (auth)
- Returns activity/progress records scoped by effective actor/subject permissions.
- Supports filters: `courseId`, `topicId`, `interactionId`, `eventTypes`, `startAt`, `endAt`, `subjectUserId` (privileged only).

### `GET /metrics` (auth)
- Returns aggregated metrics read model.
- Supports filters: `courseId`, `eventTypes`, `groupBy`, `startAt`, `endAt`, `subjectUserId` (privileged only).

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
- operation identifiers should be deterministic (`<resource>.<action>`) and stable across generations

## Legacy Gaps Addressed
- Replaces implicit service calls with explicit API contracts.
- Adds missing contracts for bootstrap session context, dashboard read model, discussion AI calls, role/delegation admin, and maintenance jobs.
- Normalizes query/filter naming across search/progress/metrics endpoints.
- Normalizes error shape and retryability semantics.
- Enforces observer actor/subject handling as first-class contract behavior.
- Defines idempotent write behavior for conflict-prone operations.
