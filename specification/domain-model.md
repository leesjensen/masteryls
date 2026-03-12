# Domain Model Specification

## Scope
This document defines the target domain model for the next-generation MasteryLS implementation.

It is normative for new development and intentionally improves on current behavior by fixing security risks, data inconsistencies, and known modeling gaps.

## Modeling Goals
- Keep business objects explicit and strongly typed.
- Separate mutable workflow state from immutable audit history.
- Keep content metadata in app data, and learning content in GitHub.
- Remove secrets from client-visible domain objects.
- Make permissions and state transitions explicit.

Policy default values used by this model are defined in:
- `policy-defaults.md`
- `policy-defaults.json`

## Bounded Contexts
- Identity and Access: users, roles, credentials, authorization.
- Catalog and Authoring: courses, modules, topics, interactions, publishing lifecycle.
- Learning Runtime: enrollments, attempts, notes, exam sessions, mastery state.
- Analytics and Audit: immutable activity events and derived metrics.
- Integration: GitHub, Canvas, AI providers via server-side integration boundaries.

## Common Conventions
- IDs: UUID (stable, opaque, globally unique).
- Timestamps: ISO-8601 UTC.
- Audit fields: `createdAt`, `updatedAt` on mutable entities.
- Soft-deletion for managed business entities; immutable deletion policy for audit events.
- Enumerations are closed sets unless explicitly marked extensible.
- Client UI preferences are not authoritative domain data.

## Core Entities

### User
Represents a human account.

Fields:
- `id`
- `email` (unique, normalized lowercase)
- `displayName`
- `status` (`active`, `suspended`, `deleted`)
- `preferences` (non-sensitive user settings only)
- `createdAt`
- `updatedAt`

Rules:
- User identity comes from the auth provider subject.
- Email is immutable after verification unless admin flow updates it.

### RoleAssignment
Represents authorization grants.

Fields:
- `id`
- `userId`
- `scopeType` (`global`, `course`)
- `scopeId` (null for global scope)
- `role` (`root`, `editor`, `mentor`, `learner`, `observer`)
- `constraints` (nullable role-specific constraint object)
- `grantedByUserId`
- `createdAt`
- `revokedAt` (nullable)

Rules:
- Active assignment is `revokedAt == null`.
- One active assignment per `(userId, scopeType, scopeId, role)`.
- No secrets or credentials stored in role settings.
- `observer` role assignments are user-level and must use `scopeType = global`.
- For `observer` role, `constraints` may further limit allowed observed users.

### ObserverDelegation
Defines which learner identities an observer can proxy in read-only mode.

Fields:
- `id`
- `observerUserId`
- `observedUserId`
- `grantedByUserId`
- `createdAt`
- `revokedAt` (nullable)

Rules:
- Active delegation is `revokedAt == null`.
- One active delegation per `(observerUserId, observedUserId)`.
- Delegation is only required for `observer` role users.
- `mentor`, `editor`, and `root` can assume observer mode for any user without explicit delegation rows.

### ObserverSession
Ephemeral read-only proxy session context for acting as another user.

Fields:
- `id`
- `actorUserId`
- `observedUserId`
- `contextCourseId` (nullable active course context)
- `assumedByRole` (`observer`, `mentor`, `editor`, `root`)
- `startedAt`
- `endedAt` (nullable)
- `reason` (nullable)

Rules:
- Observer mode is strictly read-only.
- Effective subject for read queries is `observedUserId`; actor identity remains `actorUserId` for audit.
- Session creation authorization:
  - `observer`: allowed only with active `ObserverDelegation`.
  - `mentor`, `editor`, `root`: allowed for any user.

### CredentialReference
Represents external credentials under server custody.

Fields:
- `id`
- `ownerType` (`user`, `course`, `organization`)
- `ownerId`
- `provider` (`github`, `canvas`, `ai`)
- `vaultKeyRef` (opaque reference to server-side secret store)
- `status` (`valid`, `invalid`, `revoked`, `unknown`)
- `lastValidatedAt` (nullable)
- `createdAt`
- `updatedAt`

Rules:
- Secret values are never returned to clients.
- Clients may only use credential existence/status metadata.

### Course
Represents catalog-level course metadata.

Fields:
- `id`
- `slug` (unique stable URL key)
- `name` (short code-like identifier)
- `title`
- `description`
- `state` (`draft`, `published`, `archived`)
- `visibility` (`public`, `authenticated`, `private`)
- `deleteProtected` (boolean)
- `source` (`github`)
- `sourceRef`:
  - `provider` (`github`)
  - `account`
  - `repository`
  - `defaultBranch`
- `externalRefs` (provider-specific references, non-secret)
- `defaultTopicId` (nullable until first publish)
- `createdByUserId`
- `createdAt`
- `updatedAt`

Rules:
- Course metadata is in app DB; lesson content stays in GitHub.
- `defaultTopicId` must reference a topic in the active definition.

### CourseDefinition
Represents the structured learning graph for a course version.

Fields:
- `courseId`
- `version` (monotonic integer)
- `modules` (ordered list)
- `topics` (ordered by module then topic position)
- `publishedAt` (nullable)
- `createdAt`

Module:
- `id`
- `courseId`
- `title`
- `position`
- `externalRefs` (optional)

Topic:
- `id`
- `courseId`
- `moduleId`
- `title`
- `description`
- `type` (`instruction`, `exam`, `project`, `embedded`, `video`)
- `status` (`stub`, `draft`, `published`, `archived`)
- `repoPath` (GitHub repo-relative path or canonical embedded URL for embedded/video)
- `position`
- `interactionIds` (ordered list)
- `externalRefs` (optional)

Rules:
- `repoPath` must be canonical and sanitized.
- Persisted topic paths are not raw GitHub URLs.
- Embedded/video topics store validated `https` URLs.
- Only `published` topics are visible to non-editor learners.

### InteractionDefinition
Represents an assessable or interactive block within a topic.

Fields:
- `id`
- `courseId`
- `topicId`
- `type` (`multiple_choice`, `multiple_select`, `survey`, `essay`, `file_submission`, `url_submission`, `teaching`, `prompt`)
- `title`
- `prompt`
- `config` (type-specific schema)
- `gradingPolicy` (`auto`, `manual`, `mixed`, `none`)
- `createdAt`
- `updatedAt`

Rules:
- `config` is schema-validated by type.
- Correct-answer keys never leak to learner-facing read models unless type requires it.

### Enrollment
Represents learner membership in a course.

Fields:
- `id`
- `userId`
- `courseId`
- `status` (`active`, `completed`, `withdrawn`)
- `masteryPercent` (0..100 integer)
- `lastTopicId` (nullable)
- `startedAt`
- `completedAt` (nullable)
- `createdAt`
- `updatedAt`

Rules:
- At most one active enrollment per `(userId, courseId)`.
- `masteryPercent` is derived from attempts/progress rules, not free-form edited.

### InteractionAttempt
Represents one submission/attempt by a learner.

Fields:
- `id`
- `courseId`
- `topicId`
- `interactionId`
- `enrollmentId`
- `userId`
- `attemptNumber`
- `submittedAt`
- `payload` (type-specific learner submission)
- `result`:
  - `percentCorrect` (nullable)
  - `feedback` (nullable)
  - `grader` (`ai`, `mentor`, `system`, `none`)
- `createdAt`

Rules:
- Attempts are immutable after submission.
- Subsequent attempts create new records.

### Note
Represents learner-authored notes tied to topic or section.

Fields:
- `id`
- `courseId`
- `topicId`
- `enrollmentId`
- `userId`
- `sectionKey` (nullable)
- `content`
- `createdAt`
- `updatedAt`

Rules:
- Notes are editable but history should remain auditable via event stream.

### ExamSession
Represents exam workflow state per enrollment/topic.

Fields:
- `id`
- `courseId`
- `topicId`
- `enrollmentId`
- `userId`
- `state` (`not_started`, `in_progress`, `submitted`, `graded`)
- `startedAt` (nullable)
- `submittedAt` (nullable)
- `gradedAt` (nullable)
- `aiSummary` (nullable)
- `mentorSummary` (nullable)
- `createdAt`
- `updatedAt`

Rules:
- One active exam session per `(enrollmentId, topicId)`.
- `submitted` exam content is read-only to learners.

### ActivityEvent
Immutable audit and analytics event.

Fields:
- `id`
- `eventType`
- `userId` (nullable for system events)
- `courseId` (nullable)
- `enrollmentId` (nullable)
- `topicId` (nullable)
- `interactionId` (nullable)
- `durationSec` (nullable)
- `details` (validated event payload)
- `createdAt`

Rules:
- Events are append-only and immutable.
- Canonical timestamp is `createdAt` only.
- `details` must follow per-event schema allowlists.

### Reporting Contract: ActivityEnvelope
Logical cross-domain reporting interface used by analytics, progress logs, and exports.

Fields:
- `id`
- `eventType`
- `happenedAt` (alias of canonical `createdAt`)
- `userId` (nullable)
- `courseId` (nullable)
- `enrollmentId` (nullable)
- `topicId` (nullable)
- `interactionId` (nullable)
- `sourceType` (`activity_event`, `interaction_attempt`, `exam_session`, `note`, `system`)
- `sourceId` (nullable)
- `durationSec` (nullable)
- `metrics` (nullable key/value scalar map for charting and grouping)

Rules:
- This is a reporting/read contract, not a write-side aggregate.
- Every learner-facing action that should appear in timeline or metrics must emit an `ActivityEvent` mappable to one `ActivityEnvelope`.
- Domain-specific records (`InteractionAttempt`, `ExamSession`, `Note`) remain source-of-truth and are referenced via `sourceType` + `sourceId`.
- Reporting systems use `ActivityEnvelope` and avoid direct ad-hoc joins across raw domain entities where possible.

### SearchDocument
Derived search projection of topic content.

Fields:
- `topicId`
- `courseId`
- `contentText`
- `sourceVersion` (course definition version or content SHA)
- `indexedAt`

Rules:
- Derived from canonical topic content; never edited manually.

## Aggregates And Ownership
- Course aggregate owns: CourseDefinition, Modules, Topics, InteractionDefinitions.
- Enrollment aggregate owns: ExamSession, learner progress summary.
- Attempts and ActivityEvents are immutable child records, not edited in place.
- CredentialReference is controlled by server integration boundaries.

## State Machines

### Course State
- `draft -> published -> archived`
- `published -> draft` allowed only for editors/root with explicit confirmation.
- `archived` is terminal for learner access.

### Topic Status
- `stub -> draft -> published -> archived`
- `published -> draft` allowed for editors.
- `archived` topics excluded from progression and mastery.

### Enrollment Status
- `active -> completed`
- `active -> withdrawn`
- `completed` and `withdrawn` are terminal.

### Exam Session State
- `not_started -> in_progress -> submitted -> graded`
- No backward transitions after `submitted` for learner actions.

## Permission Model
- Guest:
  - Read published public course metadata and content.
  - No enrollment, progress, note, or submission writes.
- Learner:
  - Manage own enrollments.
  - Create attempts, notes, and runtime activity in enrolled courses.
  - Read only published content.
- Observer (user scope):
  - Can enter read-only proxy mode for delegated learner user(s).
  - Reads learner-facing data as the observed user context.
  - No authoring, grading, enrollment mutation, submission, or role-management writes.
- Mentor (course scope):
  - Read scoped course metadata/content including learner submissions for mentoring workflows.
  - Read scoped analytics/progress for supported mentoring operations.
  - Add mentor feedback/assessment when `policy-defaults.json.authz.mentorCanWriteAssessmentByDefault` is true (or explicit override allows).
  - Can assume read-only observer mode for any user.
  - No course structure authoring or role-management writes by default.
- Editor (course scope):
  - Manage course definition and content metadata for scoped course.
  - Manage Canvas exports for scoped course.
  - Manage non-secret course settings.
  - Can assume read-only observer mode for any user.
- Root:
  - Global administrative operations.
  - Role and lifecycle overrides, with audit.
  - Can assume read-only observer mode for any user.

## Security And Consistency Requirements
- Secrets:
  - GitHub/Canvas/AI secrets must be server-custodied via `CredentialReference`.
  - No plaintext PAT storage in user role settings or local storage.
- Event timestamps:
  - Use `createdAt` uniformly; disallow alternate aliases.
- Path safety:
  - Course definition stores canonical `repoPath` or validated `https` URLs only.
  - Runtime raw/content URLs are derived read models.
- Role integrity:
  - Every non-archived course must retain at least one active editor.
- Data writes:
  - Mutable entities use optimistic concurrency via `version` or `updatedAt` checks.
- UI settings:
  - Kept namespaced and isolated from domain records unless explicitly promoted.

## Known Legacy Mismatches Addressed By This Model
- Removes secret-bearing role settings for GitHub tokens.
- Replaces mixed timestamp usage (`createdAt` vs `creationDate`) with one canonical field.
- Separates canonical topic path from runtime absolute content URL.
- Makes event immutability explicit and prevents ad-hoc mutable progress payloads.
- Separates permission grants from per-user arbitrary settings.

## Canonical Event Taxonomy (Initial)
- `auth.account_created`
- `auth.login`
- `auth.logout`
- `observer.delegation_granted`
- `observer.delegation_revoked`
- `observer.mode_started`
- `observer.mode_stopped`
- `enrollment.created`
- `enrollment.withdrawn`
- `enrollment.deleted`
- `learning.topic_viewed`
- `learning.embedded_viewed`
- `interaction.submitted`
- `exam.started`
- `exam.submitted`
- `note.created`
- `note.updated`
- `content.updated`
- `content.exported_canvas`

## Read Models (Derived)
Derived views can be materialized for performance:
- LearnerDashboardView: enrollments + mastery + last activity.
- CourseSidebarView: modules/topics filtered by role and publish status.
- MetricsView: rollups by date, topic, event type.
- ProgressLogView: grouped activity timeline with canonical joins.
- ActivityEnvelopeView: normalized event stream for analytics and exports.

These read models do not change source-of-truth entities.
