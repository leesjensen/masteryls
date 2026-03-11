# Classroom Learning Specification

## Scope
This document defines the target classroom experience for:
- course/topic navigation
- topic rendering
- interaction execution
- progress capture
- discussion/notes
- observer-mode behavior

It is aligned to:
- `domain-model.md`
- `auth-authorization.md`
- `routing-state.md`

## User Outcomes
- Learners can reliably navigate and complete course topics.
- Learning interactions are immediate, auditable, and measurable.
- Editors can preview authored content exactly as learners see it.
- Mentors can review learner work and provide feedback.
- Observers can proxy learner views in strict read-only mode.

## Entry And Session Resolution
- Classroom route: `/course/:courseId/topic/:topicId`.
- If `topicId` is missing, resolve deterministic default topic:
  1. `course.defaultTopicId` if visible in current subject context.
  2. first visible topic by module/topic position.
  3. course empty-state (`no_visible_topics`).
- Learning context is resolved per request:
  - actor identity (`actorUserId`)
  - effective subject identity (`subjectUserId`; equals observed user in observer mode)
  - course visibility + role permissions
  - enrollment for `subjectUserId` (nullable for guests)

## Classroom Layout (Target)
- Top toolbar:
  - topic navigation (`prev`/`next`)
  - mode indicators (view/edit, observer-mode banner)
  - external links (GitHub, Canvas) subject to role/capability.
- Course pane (configurable width, left side):
  - topics tree
  - course search
  - settings tab (authorized roles only).
  - resizable/collapsible.
- Main content pane:
  - instruction renderer or editor (role + mode dependent)
- Right discussion pane:
  - available in learning view for authenticated users
  - supports AI discussion and notes
  - resizable/collapsible.

Responsive behavior:
- Support split/overlay Course pane behaviors by viewport.
- Preserve user UI preferences per course in namespaced local storage.
- Persist Course pane and Discussion pane width/visibility preferences per course.

### Discussion Pane Availability
- Guest:
  - not available.
- Learner:
  - available; can create AI prompts and notes.
- Mentor/Editor/Root (non-observer mode):
  - available; can use discussion tools in their active subject context.
- Observer mode:
  - visible for observed-user context but strictly read-only (no message/note submission).

## Topic Visibility Rules
- Guest:
  - published topics only, only for public courses.
- Learner:
  - published topics visible for enrolled/allowed courses.
- Observer mode:
  - visibility computed as observed user subject context.
- Mentor/Editor/Root (non-observer mode):
  - may view draft/archived as allowed by policy.

## Topic Type Behavior

### Instruction / Project
- Render markdown with approved plugin pipeline and sanitization.
- Support rich media and internal topic linking.
- Render interaction blocks from structured fenced payloads.

### Embedded / Video
- Render validated `https` iframe/content source.
- Track view activity with duration thresholds.

### Exam
- Managed by `ExamSession` state machine:
  - `not_started -> in_progress -> submitted -> graded`
- After `submitted`, learner view is read-only.
- Exam submissions produce immutable attempt records and exam events.

## Interaction Model

Supported interaction types:
- `multiple_choice`
- `multiple_select`
- `survey`
- `essay`
- `file_submission`
- `url_submission`
- `teaching`
- `prompt`

Execution rules:
- Each submission creates a new immutable `InteractionAttempt`.
- Attempts are associated to course/topic/enrollment/user/interactions.
- Auto-feedback can be AI- or system-generated per interaction policy.
- Mentor assessments are separate privileged actions and audited.

Validation rules:
- Submission payload schema is enforced by interaction type.
- Client-side validation is UX only; server-side validation is authoritative.

## Progress And Activity Tracking
- Classroom emits canonical `ActivityEvent` records for:
  - topic views
  - interaction submissions
  - exam lifecycle transitions
  - note create/update events
- Enrollment mastery is derived from attempts/progress rules, not manually edited.
- Canonical timestamps are `createdAt` only.
- Duration tracking must avoid duplicate over-counting on route changes/tab visibility transitions.

## Discussion And Notes

### Discussion (AI)
- Context-aware assistant can discuss current topic content.
- Discussion history is user-local and optional to persist client-side.
- Clearing discussion history is user action and does not alter canonical learning records.

### Notes
- Notes are canonical domain records (`Note`), not only transient UI messages.
- Notes can be scoped to topic section anchors.
- Note creation/update emits corresponding activity events.

## Observer Mode In Classroom
- Observer mode is explicit and read-only.
- Actor may view classroom as observed subject:
  - observer role: only delegated users.
  - mentor/editor/root: any user.
- In observer mode:
  - all write controls are disabled/hidden (submit, commit, note edit, enrollment mutation).
  - interaction inputs are non-submitting preview/read state.
  - toolbar shows persistent "Viewing as <user> (read-only)" with exit control.
  - all reads use observed subject context for enrollment/progress/topic availability.
- Every observer-mode classroom access is auditable with actor + observed IDs.

## Authoring Preview In Classroom
- Editor mode is separate from learner runtime but shares rendering engine for parity.
- Preview pane must reflect learner-facing behavior, including interaction rendering semantics.
- Preview must never mutate learner attempts/progress.
- Unsaved editor content is guarded on navigation transitions.

## Search In Classroom
- Course search uses indexed topic content projection (`SearchDocument`).
- Search results deep-link to topic and highlight matched snippets.
- Visibility filtering applies before showing results.

## Navigation Semantics
- `prev`/`next` navigation uses visible topic ordering for current subject context.
- Hidden/non-visible topics (for example `draft` or `archived`) are skipped unless role allows visibility.
- Hash navigation anchors within topic content are preserved.

## Error And Empty States
- Missing course/topic -> `404`.
- Access denied -> `403`.
- No visible topics -> dedicated empty-state within classroom shell.
- Content load failure:
  - show retry action
  - avoid blank/null-only render.

## Security Requirements
- Markdown rendering must use strict sanitization and protocol allowlists.
- No execution of untrusted script content from course markdown.
- Interaction answer keys and grading logic exposure follows policy by role/context.
- In observer mode, all write API endpoints must enforce deny even if client is tampered.

## Accessibility Requirements
- Keyboard navigation for:
  - topic list
  - previous/next controls
  - interaction form elements
  - discussion panel controls
- Visible focus states for all interactive controls.
- Screen-reader labels for editor/view toggles, mode badges, and submission status.

## Telemetry And Auditing
- Required event emission:
  - `learning.topic_viewed`
  - `learning.embedded_viewed`
  - `interaction.submitted`
  - `exam.started`
  - `exam.submitted`
  - `note.created`
  - `note.updated`
  - observer mode access events when active
- Event payloads must include course/topic/user context and outcome status.

## Legacy Gaps Addressed
- Replaces overloaded mutable progress payloads with explicit attempts/events/sessions.
- Removes client-only assumptions for protected write actions.
- Standardizes behavior for guests vs learners vs observer-mode subject context.
- Formalizes read-only proxy behavior for observer workflows.
