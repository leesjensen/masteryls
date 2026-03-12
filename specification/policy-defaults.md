# Policy Defaults Specification

## Scope
This document defines canonical default policy values used when other specs say "by policy", "policy default", or "policy-configurable".

The canonical machine-readable source of these defaults is:
- `policy-defaults.json`

If an implementation adds policy overrides, it must start from these defaults and record changes in a dedicated policy changelog.

## Contract Rules
- Defaults in `policy-defaults.json` are normative for generation.
- Runtime configuration may override defaults only through explicit server-managed policy settings.
- UI-only toggles are not authoritative policy.
- Any default change is a contract change and must update:
  - this file
  - `policy-defaults.json`
  - `implementation-status.md`

## Default Matrix

### Authorization
- `editorCanManageCourseRoles`: `false`
- `nonRootCanManageObserverDelegations`: `false`
- `mentorCanWriteNotesByDefault`: `false`
- `mentorCanWriteAssessmentByDefault`: `true`
- `requireAtLeastOneActiveEditorPerCourse`: `true`

### Course Creation
- `defaultVisibility`: `authenticated`
- `defaultDeleteProtected`: `true`
- `autoEnrollCreator`: `true`
- `ensureOverviewTopic`: `true`

### Observer Mode
- `sessionTtlMinutes`: `120`
- `requireReason`: `false`

### Search / Progress / Metrics
- Search:
  - `minQueryLength`: `2`
  - `defaultLimit`: `20`
  - `maxLimit`: `100`
- Progress:
  - `defaultLimit`: `50`
  - `maxLimit`: `100`
  - `defaultGroupingWindowMinutes`: `60`
- Metrics:
  - `defaultWindowDays`: `30`
  - `maxWindowDays`: `365`

### Discussion And AI
- `maxHistoryMessages`: `16`
- `maxNoteContextChars`: `3000`
- `targetMaxReplyWords`: `200`

### Authoring
- `aiCommitMessageEnabled`: `true`
- `aiCommitMessageTimeoutMs`: `1200`
- `fallbackCommitTemplate`: `update(topic): summarize meaningful content change`

### Dashboard
- `defaultDiscoverSort`: `relevance`, then `title`
- `showCompletedEnrollmentsByDefault`: `false`

### Admin
- `defaultDeleteRepositoryOnCourseDelete`: `false`
- `rootCanOverrideDeleteProtection`: `true`

## Legacy Gaps Addressed
- Removes ambiguity around policy-configurable defaults.
- Makes generation behavior deterministic for policy-sensitive features.
- Keeps role and observer behavior consistent across all specs.
