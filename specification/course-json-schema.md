# Course JSON Schema Specification

## Scope
This document defines the canonical `course.json` contract used as the course structure source in GitHub.

Canonical machine-readable schema:
- `schemas/course-json.schema.json`

This schema is normative for:
- course creation output validation
- authoring structure commits (`PUT /courses/{courseId}/definition`)
- generator validation stages

## Contract Rules
- `course.json` MUST validate against `schemas/course-json.schema.json`.
- Semantic checks that require cross-record references MUST also pass:
  - every `topic.moduleId` exists in `modules[]`
  - `course.defaultTopicId`, when non-null, exists in `topics[]`
  - module/topic ordering rules are deterministic by `position`
- IDs are stable once assigned.
- Embedded/video topic `repoPath` must be an `https://` URL.
- Non-embedded topics use repository-relative paths.

## Normalization Requirements
Before persisting or committing `course.json`:
1. Normalize ordering by module `position`, then topic `position`.
2. Normalize legacy aliases to canonical enum values.
3. Ensure missing optional arrays (`interactionIds`, `interactions`) default to empty arrays.
4. Reject unknown top-level fields unless explicitly added to schema.

## Relationship To Other Specs
- Domain shape: `domain-model.md`
- Create flow: `course-creation.md`
- Authoring commit flow: `editor-github-authoring.md`
- DB persistence mapping: `database-schema-migrations.md`

## Legacy Gaps Addressed
- Replaces prose-only `course.json` shape with machine-derivable JSON schema.
- Makes generator validation deterministic.
- Reduces structure drift across creation, authoring, and runtime loading.
