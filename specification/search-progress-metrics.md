# Search, Progress, And Metrics Specification

## Scope
This document defines target behavior for:
- course-scoped content search
- learner activity/progress timeline
- analytics/metrics dashboards

It is aligned to:
- `domain-model.md`
- `auth-authorization.md`
- `classroom-learning.md`
- `routing-state.md`

## Design Goals
- Provide fast, relevant search across course content.
- Make progress/activity views accurate, auditable, and user-safe.
- Support role-aware analytics without leaking data across users.
- Keep reporting contracts stable even as write-side domain entities evolve.

## Canonical Data Model For Reporting
- Search reads from `SearchDocument` projection.
- Progress timeline and metrics read from `ActivityEnvelope` (derived from `ActivityEvent` and related source entities).
- Source entities (`InteractionAttempt`, `ExamSession`, `Note`) remain write-side records and are referenced in envelopes via `sourceType` and `sourceId`.

Rules:
- `createdAt` is canonical event timestamp.
- `happenedAt` in reporting is an alias of `createdAt` only.
- No legacy `creationDate` field usage.

## Access Control

### Subject Resolution
All progress/metrics/search requests execute in an actor+subject context:
- `actorUserId`: authenticated caller
- `subjectUserId`: user whose learner data is being read

Rules:
- default `subjectUserId = actorUserId`
- in observer mode, `subjectUserId = observedUserId`
- actor identity is always preserved for audit

### Role Permissions
- Guest:
  - may search published public course content
  - cannot read learner progress or learner metrics
- Learner:
  - can read own progress timeline and own metrics
  - can search enrolled/published course content they can access
- Observer:
  - read-only access for delegated observed user(s)
  - cannot mutate progress, notes, or analytics state
- Mentor:
  - can read scoped learner progress/metrics where course policy allows
  - can assume observer mode for any user (read-only subject context)
- Editor:
  - can read scoped learner progress/metrics for managed courses by policy
  - can assume observer mode for any user (read-only subject context)
- Root:
  - global read with audit
  - can assume observer mode for any user

Security guardrails:
- any cross-user read requires explicit server authorization
- UI filters do not grant access; server enforces scope
- observer mode denies all write endpoints

## Course Search

### Search Surface
- Search is available in the Course pane on the `Search` tab.
- Search scope is current course only.
- Search result selection navigates to the matched topic.

### Query Contract
Input:
- `courseId` (required)
- `query` (required)
- `limit` (optional, default policy value)

Output:
- `query`
- `matches[]`:
  - `topicId`
  - `topicTitle`
  - `headlines[]` (highlighted snippets; safe-markup only)
  - `rank`

Behavior:
- trim and normalize query text
- enforce minimum query length (policy default `>= 2`)
- return deterministic rank-desc order
- empty query returns empty result set (not full topic dump)

### Indexing And Freshness
- Index source is canonical topic markdown/content at latest default-branch state.
- Indexing uses sanitized plain-text extraction from markdown.
- Search documents carry `sourceVersion` and `indexedAt`.
- Reindex operations are idempotent and auditable.
- If index lags source content, UI should expose a reindex/freshness action (authorized roles only).

Incremental update requirement:
- On successful topic create or topic content edit, the affected topic's `SearchDocument` must be updated automatically.
- Trigger point is post-commit/persist success (not on unsaved editor draft changes).
- If incremental indexing fails, the system must:
  - surface a non-blocking warning to authorized users
  - emit an audit/ops event
  - keep course-level reindex available as recovery.

## Progress Timeline

### View Purpose
Progress timeline provides a chronological learner activity history with filters and drill-in navigation.

### Query Contract
Input:
- `subjectUserId` (resolved server-side unless explicit, authorized override)
- optional filters:
  - `courseId`
  - `topicId`
  - `interactionId`
  - `eventTypes[]`
  - `startAt` / `endAt` (ISO UTC)
- pagination:
  - `cursor` (preferred) or `page`+`limit` (legacy compatibility)
- sort:
  - `createdAt desc` default

Output:
- `items[]` (`ActivityEnvelope`)
- pagination metadata (`nextCursor`, `totalCount` where supported)

### Timeline Grouping (Read Model Policy)
Grouping is a presentation/read concern and must not mutate source events.

Recommended default grouping:
- group contiguous events with same:
  - `courseId`
  - `topicId` (except configurable event families such as topic-view streaks)
  - `eventType`
- apply max grouping window (default 1 hour)

Group contract:
- `groupId`
- `eventType`
- `firstCreatedAt`
- `lastCreatedAt`
- `eventCount`
- `totalDurationSec`
- `topicCount` (for cross-topic grouped views)
- `events[]` (expand-on-demand)

### Timeline UX Requirements
- show explicit empty state when no events match filters
- allow jump-to-topic only when mapped topic/course is accessible
- show event timestamps in user locale while preserving UTC in data payloads
- keep filter state stable across pagination
- avoid lossy client parsing hacks (e.g., serialized JSON arrays in filter strings)

## Metrics Dashboard

### Metrics Scope
Metrics are derived from the same `ActivityEnvelope` stream, filtered by permission and query scope.

Supported slices:
- total activity count
- total/average duration
- activity type distribution
- hourly and daily trends
- top topics
- active-day and weekly rollups

### Query Contract
Input:
- `subjectUserId` (default resolved from context)
- optional:
  - `courseId`
  - `startAt` / `endAt`
  - `eventTypes[]`
  - `groupBy` options (`hour`, `day`, `week`, `eventType`, `topic`)

Output:
- `summary`:
  - `totalActivities`
  - `totalDurationSec`
  - `averageDurationSec`
  - `firstActivityAt` (nullable)
  - `lastActivityAt` (nullable)
- `series`:
  - `byHour[]`
  - `byDay[]`
  - `byWeek[]`
  - `byEventType[]`
  - `topTopics[]`

Rules:
- date bounds are inclusive and timezone-normalized
- when dataset is empty, return zeroed summary and empty arrays (not errors)
- metrics should be computed server-side for large datasets

### Cross-User Metrics
- Learner/Observer: only current subject.
- Mentor/Editor/Root: may filter by specific user only when authorized.
- Any “all users” aggregate requires explicit privileged capability and audit tagging.

## Event Taxonomy Alignment
Timeline and metrics must use canonical event taxonomy from `domain-model.md`.

Legacy-to-canonical normalization examples:
- `instructionView` -> `learning.topic_viewed`
- `embeddedView` -> `learning.embedded_viewed`
- `quizSubmit` -> `interaction.submitted`
- `exam` -> `exam.submitted` or `exam.started` based on state transition
- `note` -> `note.created` / `note.updated`
- `userLogin` -> `auth.login`
- `userLogout` -> `auth.logout`
- `accountCreation` -> `auth.account_created`

## Audit And Observability
Must emit auditable analytics access events for privileged cross-user reads:
- `analytics.progress_read`
- `analytics.metrics_read`
- `analytics.search_executed` (for protected scopes)

Payload includes:
- `actorUserId`
- `subjectUserId`
- scope (`courseId`, filters summary)
- outcome (`success`, `denied`, `failed`)

## Performance Requirements
- Search responses should be optimized for interactive use (target p95 under policy threshold).
- Progress timeline queries must support pagination without full-table scans.
- Metrics queries should support bounded windows and pre-aggregation where needed.
- Topic/course title resolution for timeline rows should be batched, not per-row fetch loops.

## Error Handling
- `403`: unauthorized scope/user access.
- `400`: invalid filters/date range/type values.
- `422`: unsupported query combination.
- partial-data states should return structured warnings instead of silent truncation.

UI behavior:
- show clear retry path for transient failures
- keep last valid view visible when refresh fails, with stale-data indicator

## Security Requirements
- enforce server-side subject scoping and role checks for every query
- prevent editor-wide implicit data leakage in “my activity” views
- sanitize highlighted snippets and any rendered search fragment HTML
- never expose secrets/credentials in analytics payloads or logs

## Legacy Gaps Addressed
- Eliminates mixed timestamp fields and canonicalizes on `createdAt`.
- Replaces client-side ad hoc metrics computation over capped datasets with scalable server-side aggregation.
- Fixes ambiguous user scoping in progress/metrics queries by enforcing actor+subject context.
- Removes brittle filter serialization patterns that caused inconsistent behavior.
- Unifies progress and metrics on `ActivityEnvelope` so split domain entities remain easy to aggregate.
