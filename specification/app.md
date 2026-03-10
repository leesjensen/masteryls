# MasteryLS Application Specification (High-Level)

## Purpose
MasteryLS is a web-based learning system for delivering and authoring course content with a mastery focus.

Core product goals:
- Deliver structured learning content organized as courses, modules, and topics.
- Support learner progress tracking and interaction-based mastery signals.
- Make course content maintainable by storing source content in GitHub.
- Accelerate authoring and learner support through AI-assisted generation and feedback.
- Support export/synchronization of course content to Canvas LMS.

## System Context
MasteryLS is a React single-page application that integrates with external systems:
- Supabase: authentication (OTP), relational data, search index table, edge functions.
- GitHub: source of truth for course content (`course.json`, markdown, media), version history, file commits.
- Gemini (through Supabase edge function): AI generation and feedback.
- Canvas (through Supabase edge function): course/module/page export and reference repair.

## Primary Actors And Permissions
- Guest (not logged in): can browse published course catalog and open course content.
- Learner (logged in): can enroll, learn, complete interactions, take notes, view own activity/progress.
- Observer (user-scoped role): read-only proxy access for specific learner user(s) assigned through observer delegation.
- Mentor (course-scoped role): can review learner work and provide mentor feedback/assessment, and can assume observer mode for any user.
- Editor (course-scoped role): can edit course structure/content, manage GitHub-backed course assets, export to Canvas.
- Root (global role): administrative visibility and elevated management actions, including observer-mode assumption for any user.

## Runtime Architecture
- App bootstrap:
  - Loads current user session from Supabase.
  - Creates router and global providers (alerts, progress overlay).
- Router-level pages:
  - `/` start page and public catalog entry points.
  - `/dashboard` enrollment and course selection hub.
  - `/course/:courseId[/topic/:topicId]` classroom.
  - `/metrics`, `/progress`, `/courseCreation`, `/courseExport`.
- Shared app state:
  - `user` (authenticated principal + roles).
  - `learningSession` (current `course`, `topic`, `enrollment`).
  - per-course UI settings in local storage (sidebar state, open TOC modules, current topic, etc.).
- Domain orchestration layer:
  - `useCourseOperations` acts as the application service facade used by most views.

## Core Domain Model
- User: identity and profile metadata.
- CatalogEntry (course metadata): course id/title/description, GitHub repo location, publication settings.
- Course (runtime, loaded from GitHub): modules, topics, links, external refs, cache.
- Topic: typed learning unit (`instruction`, `exam`, `project`, `embedded`/`video`).
- Enrollment: learner-course association with progress state.
- Progress event: immutable activity records (views, submissions, notes, auth events, exam events).

## Functional Scope
1. Authentication And Identity
- Email OTP login/signup via Supabase auth.
- First-login user record upsert into app `user` table.
- Logout clears app-local state.

2. Course Discovery And Enrollment
- Dashboard shows enrolled courses and published courses available for enrollment.
- Enrollment creation/deletion is persisted in Supabase.
- Learner cards expose course mastery percentage and quick navigation.

3. Classroom Delivery
- Left sidebar tabs: Topics, Search, Settings.
- Topic navigation supports previous/next traversal and keyboard shortcuts.
- Topic types:
  - Instruction/Project: markdown + embedded interactive blocks.
  - Embedded/Video: iframe-based content.
  - Exam: gated start/in-progress/submitted states with read-only review on completion.

4. Interactive Learning Blocks
- Custom fenced block format: ```` ```masteryls {json-metadata} ... ``` ````.
- Supported interaction types:
  - multiple-choice, multiple-select, survey, essay, file-submission, url-submission, teaching, prompt.
- Submissions create progress events; AI feedback used for graded interactions where applicable.

5. Notes And AI Discussion
- Topic discussion panel supports two modes:
  - AI discussion (persistent per-topic local history).
  - Learner notes (saved as progress records).
- Section-scoped discussion/notes can be triggered from markdown headings.

6. Authoring And Content Management (Editor)
- Toggle between learner view and editor mode in classroom.
- Markdown editor (Monaco) with formatting tools, quiz insertion templates, AI insertion helpers.
- Side-by-side editor preview synchronized by scroll position.
- Commit/discard workflow writes content changes back to GitHub.
- Commit history can be viewed and loaded for diffing.
- Topic file panel supports upload, delete, selection, and markdown insertion.
- Course structure editing supports module/topic add, rename, delete, and drag-and-drop reorder.

7. Course Administration
- Course settings edit: name/title/description, publication state, delete protection, GitHub repo binding.
- Editor management: search users and add/remove editor roles.
- Maintenance actions: search index rebuild and content freshness refresh.
- Optional destructive flow: delete course + backing repository.

8. Course Creation
- Create course from:
  - a GitHub template repository, or
  - AI-generated course structure.
- Provisions target GitHub repo, writes/updates `course.json`, assigns editor role, creates creator enrollment.

9. Canvas Export
- Export full course to Canvas modules/pages.
- Optional cleanup of existing Canvas pages/modules before export.
- Save cross-system references back to course metadata for future incremental updates.
- Repair mode reconciles existing Canvas pages to topic references.

10. Search, Progress, Metrics
- Full-text search over indexed topic content (per course).
- Activity log view with filters, grouping, pagination, and topic/course resolution.
- Metrics dashboard with date/course/user filters and charts (activity volume, type, topic trends, durations).

## Content Source Contract
A course repository is expected to provide:
- `course.json` at repo root (preferred).
- Topic markdown/media files referenced by paths in `course.json`.
- Fallback support can derive structure from `instruction/modules.md` if `course.json` is absent.

`course.json` defines modules/topics and operational metadata (topic type, state, interactions, external refs).

## Persistence And State Boundaries
- Supabase DB persists users, roles, catalog entries, enrollments, progress, and indexed topic text.
- GitHub persists authored instructional content and assets.
- Local storage persists UI preferences and topic-level AI discussion cache.
- In-memory global stores support app bar state, search state, and interaction-progress state.

## Initial Spec Map (Detailed Files To Author Next)
- [System Architecture](./architecture-system.md)
- [Routing And App State](./routing-state.md)
- [Domain Model](./domain-model.md)
- [Authentication And Authorization](./auth-authorization.md)
- [Dashboard And Enrollment](./dashboard-enrollment.md)
- [Classroom Learning Experience](./classroom-learning.md)
- [Markdown And Interaction Engine](./markdown-interactions.md)
- [Discussion And Notes](./discussion-notes.md)
- [Editor And GitHub Authoring](./editor-github-authoring.md)
- [Course Settings And Admin Workflows](./course-settings-admin.md)
- [Course Creation Workflow](./course-creation.md)
- [Canvas Export Workflow](./canvas-export.md)
- [Search, Progress, And Metrics](./search-progress-metrics.md)
- [Integrations: Supabase, GitHub, Gemini, Canvas](./integrations.md)
- [Test Strategy And Coverage](./test-strategy.md)

## Out Of Scope For This Document
This file is intentionally high-level. It does not yet define:
- Detailed UI specs per component/view.
- API-level request/response contracts for each integration call.
- Exact database schema and migration rules.
- Error-state matrix and retry/backoff behavior.
- Security hardening requirements and threat model.
