# Database Schema And Migration Specification

## Scope
This document defines the canonical relational schema, constraints, indexing strategy, RLS expectations, and migration lifecycle required to recreate MasteryLS operational data.

It is aligned to:
- `domain-model.md`
- `auth-authorization.md`
- `integrations.md`
- `search-progress-metrics.md`
- `api-contracts.md`

## Design Goals
- Explicit schema-first persistence contracts.
- Strict integrity constraints for domain invariants.
- RLS-first security model for protected tables.
- Migrations that are reproducible, reversible, and low-risk.

## Global Conventions
- Database: PostgreSQL (Supabase-managed).
- IDs: `uuid` (server-generated default).
- Time columns: `timestamptz` in UTC.
- Naming: `snake_case`; table names singular.
- Mutable tables include `created_at`, `updated_at`.
- Audit/event tables are append-only.
- Operational tables are private; browser roles (`anon`, `authenticated`) have no direct table grants.

## Canonical Tables

### `app_user`
Purpose: application profile linked to auth identity.

Columns:
- `id uuid primary key` (matches auth subject id)
- `email text not null unique`
- `display_name text not null`
- `status text not null check (status in ('active','suspended','deleted'))`
- `preferences jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- unique index on `email`

### `role_assignment`
Columns:
- `id uuid primary key`
- `user_id uuid not null references app_user(id)`
- `scope_type text not null check (scope_type in ('global','course'))`
- `scope_id uuid null`
- `role text not null check (role in ('root','editor','mentor','learner','observer'))`
- `constraints jsonb not null default '{}'::jsonb`
- `granted_by_user_id uuid not null references app_user(id)`
- `created_at timestamptz not null default now()`
- `revoked_at timestamptz null`

Constraints:
- scope consistency:
  - `(scope_type = 'global' and scope_id is null) or (scope_type = 'course' and scope_id is not null)`
- observer scope rule:
  - if `role = 'observer'` then `scope_type = 'global'`
- one active assignment:
  - unique partial index on `(user_id, scope_type, scope_id, role)` where `revoked_at is null`

### `observer_delegation`
Columns:
- `id uuid primary key`
- `observer_user_id uuid not null references app_user(id)`
- `observed_user_id uuid not null references app_user(id)`
- `granted_by_user_id uuid not null references app_user(id)`
- `created_at timestamptz not null default now()`
- `revoked_at timestamptz null`

Constraints:
- no self-observation: `observer_user_id <> observed_user_id`
- one active delegation per pair (partial unique index where `revoked_at is null`)

### `observer_session`
Columns:
- `id uuid primary key`
- `actor_user_id uuid not null references app_user(id)`
- `observed_user_id uuid not null references app_user(id)`
- `context_course_id uuid null`
- `assumed_by_role text not null check (assumed_by_role in ('observer','mentor','editor','root'))`
- `started_at timestamptz not null default now()`
- `ended_at timestamptz null`
- `reason text null`

Indexes:
- active sessions by actor: `(actor_user_id, started_at desc)` where `ended_at is null`

### `credential_reference`
Columns:
- `id uuid primary key`
- `owner_type text not null check (owner_type in ('user','course','organization'))`
- `owner_id uuid not null`
- `provider text not null check (provider in ('github','canvas','ai'))`
- `vault_key_ref text not null unique`
- `status text not null check (status in ('valid','invalid','revoked','unknown'))`
- `last_validated_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- one active credential reference per `(owner_type, owner_id, provider)`

### `course`
Columns:
- `id uuid primary key`
- `slug text not null unique`
- `name text not null`
- `title text not null`
- `description text not null`
- `state text not null check (state in ('draft','published','archived'))`
- `visibility text not null check (visibility in ('public','authenticated','private'))`
- `delete_protected boolean not null default true`
- `source text not null check (source = 'github')`
- `source_ref jsonb not null`
- `external_refs jsonb not null default '{}'::jsonb`
- `default_topic_id uuid null`
- `created_by_user_id uuid not null references app_user(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- unique `slug`
- `(state, visibility)` for catalog queries

### `course_definition_version`
Columns:
- `id uuid primary key`
- `course_id uuid not null references course(id)`
- `version integer not null check (version > 0)`
- `definition jsonb not null`
- `published_at timestamptz null`
- `created_at timestamptz not null default now()`

Constraints:
- unique `(course_id, version)`

### `course_module`
Columns:
- `id uuid primary key`
- `course_id uuid not null references course(id)`
- `definition_version_id uuid not null references course_definition_version(id)`
- `title text not null`
- `position integer not null check (position >= 0)`
- `external_refs jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- unique `(definition_version_id, position)`

### `course_topic`
Columns:
- `id uuid primary key`
- `course_id uuid not null references course(id)`
- `module_id uuid not null references course_module(id)`
- `definition_version_id uuid not null references course_definition_version(id)`
- `title text not null`
- `description text not null default ''`
- `type text not null check (type in ('instruction','exam','project','embedded','video'))`
- `status text not null check (status in ('stub','draft','published','archived'))`
- `repo_path text not null`
- `position integer not null check (position >= 0)`
- `external_refs jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- unique `(definition_version_id, module_id, position)`

### `interaction_definition`
Columns:
- `id uuid primary key`
- `course_id uuid not null references course(id)`
- `topic_id uuid not null references course_topic(id)`
- `definition_version_id uuid not null references course_definition_version(id)`
- `type text not null check (type in ('multiple_choice','multiple_select','survey','essay','file_submission','url_submission','teaching','prompt'))`
- `title text not null default ''`
- `prompt text not null default ''`
- `config jsonb not null default '{}'::jsonb`
- `grading_policy text not null check (grading_policy in ('auto','manual','mixed','none'))`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- `(topic_id, type)`

### `enrollment`
Columns:
- `id uuid primary key`
- `user_id uuid not null references app_user(id)`
- `course_id uuid not null references course(id)`
- `status text not null check (status in ('active','completed','withdrawn'))`
- `mastery_percent integer not null default 0 check (mastery_percent >= 0 and mastery_percent <= 100)`
- `last_topic_id uuid null references course_topic(id)`
- `settings jsonb not null default '{}'::jsonb`
- `started_at timestamptz not null default now()`
- `completed_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- one active enrollment per `(user_id, course_id)` (partial unique index where `status = 'active'`)

### `interaction_attempt`
Columns:
- `id uuid primary key`
- `course_id uuid not null references course(id)`
- `topic_id uuid not null references course_topic(id)`
- `interaction_id uuid not null references interaction_definition(id)`
- `enrollment_id uuid not null references enrollment(id)`
- `user_id uuid not null references app_user(id)`
- `attempt_number integer not null check (attempt_number > 0)`
- `submitted_at timestamptz not null default now()`
- `payload jsonb not null`
- `result jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Constraints:
- unique `(enrollment_id, interaction_id, attempt_number)`

Indexes:
- `(user_id, created_at desc)`
- `(course_id, topic_id, created_at desc)`

### `exam_session`
Columns:
- `id uuid primary key`
- `course_id uuid not null references course(id)`
- `topic_id uuid not null references course_topic(id)`
- `enrollment_id uuid not null references enrollment(id)`
- `user_id uuid not null references app_user(id)`
- `state text not null check (state in ('not_started','in_progress','submitted','graded'))`
- `started_at timestamptz null`
- `submitted_at timestamptz null`
- `graded_at timestamptz null`
- `ai_summary text null`
- `mentor_summary text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- `(enrollment_id, topic_id, state)`

### `note`
Columns:
- `id uuid primary key`
- `course_id uuid not null references course(id)`
- `topic_id uuid not null references course_topic(id)`
- `enrollment_id uuid not null references enrollment(id)`
- `user_id uuid not null references app_user(id)`
- `section_key text null`
- `content text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- `(user_id, course_id, topic_id, updated_at desc)`

### `activity_event`
Columns:
- `id uuid primary key`
- `event_type text not null`
- `user_id uuid null references app_user(id)`
- `subject_user_id uuid null references app_user(id)`
- `course_id uuid null references course(id)`
- `enrollment_id uuid null references enrollment(id)`
- `topic_id uuid null references course_topic(id)`
- `interaction_id uuid null references interaction_definition(id)`
- `duration_sec integer null check (duration_sec is null or duration_sec >= 0)`
- `details jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Indexes:
- `(user_id, created_at desc)`
- `(subject_user_id, created_at desc)`
- `(course_id, created_at desc)`
- `(event_type, created_at desc)`

### `search_document`
Columns:
- `id uuid primary key`
- `course_id uuid not null references course(id)`
- `topic_id uuid not null references course_topic(id)`
- `topic_title text not null`
- `path text not null`
- `body_text text not null`
- `search_vector tsvector not null`
- `updated_from_commit_sha text null`
- `indexed_at timestamptz not null default now()`

Constraints and indexes:
- unique `(course_id, topic_id)`
- GIN index on `search_vector`

### `integration_job_run`
Purpose: idempotent and auditable long-running operations (export/repair/reindex).

Columns:
- `id uuid primary key`
- `job_type text not null check (job_type in ('canvas_export','canvas_repair','search_reindex'))`
- `status text not null check (status in ('queued','running','success','partial_failure','failed','cancelled'))`
- `course_id uuid null references course(id)`
- `actor_user_id uuid not null references app_user(id)`
- `subject_user_id uuid null references app_user(id)`
- `idempotency_key text null unique`
- `request_payload jsonb not null default '{}'::jsonb`
- `result_payload jsonb not null default '{}'::jsonb`
- `error_payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `started_at timestamptz null`
- `completed_at timestamptz null`

## Referential Integrity Rules
- Foreign keys use `on delete restrict` by default.
- Domain entity deletion is soft-delete where required by policy.
- `activity_event` is immutable and never cascade-deleted.

## RLS Expectations
RLS must be enabled for all protected tables.

Access boundary requirements:
- direct browser table access is denied for operational tables.
- API/edge trusted execution contexts perform table reads/writes after authz checks.

Policy classes:
- owner read/write (`user_id = auth.uid()`) for learner-owned entities.
- scoped read for mentor/editor/root by course scope.
- observer-mode read uses `subject_user_id` context from active observer session.
- observer mode write denial on all mutation tables.
- role/credential/admin writes restricted to root or explicit scoped admin policy.

## Migration Lifecycle

### Naming
- `YYYYMMDDHHMM__<short_description>.sql`

### Strategy
Use expand-migrate-contract:
1. Expand: add new nullable columns/tables/indexes.
2. Migrate: backfill in batches with verification.
3. Contract: enforce not-null/constraints and remove obsolete fields.

### Required Baseline Migration Sequence
1. identity and access tables (`app_user`, `role_assignment`, `observer_*`, `credential_reference`)
2. course metadata and definition versioning (`course`, `course_definition_version`, `course_module`, `course_topic`, `interaction_definition`)
3. runtime learner records (`enrollment`, `interaction_attempt`, `exam_session`, `note`)
4. analytics/search (`activity_event`, `search_document`, `integration_job_run`)
5. RLS policies and supporting indexes

### Migration Verification Requirements
For every migration:
- forward migration test in clean environment
- rollback safety check (where reversible)
- data integrity checks for unique and FK constraints
- performance check for major query paths
- RLS policy tests for guest/learner/observer/mentor/editor/root

## Data Retention And Purge
- `activity_event` retained for analytics and audit retention window.
- `integration_job_run` retained for operations troubleshooting.
- soft-delete + archival workflow for user/course data where required by policy.

## Legacy Gaps Addressed
- Replaces implicit shape assumptions with explicit relational schema.
- Makes observer and actor/subject context first-class in data design.
- Defines idempotency and operational run tracking for long-running integrations.
- Formalizes migration workflow required for reproducible regeneration.
