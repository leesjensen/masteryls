# MasteryLS React Application Analysis

## Scope and Method
This analysis reviews the React application in this repository (`src`, `index.jsx`, `config.js`, and related feature modules) by static code inspection. No runtime penetration testing was performed.

## Architecture
The app is a client-side React SPA (Vite + React Router) with a service-centric data layer.

- **Bootstrap and composition**
  - `index.jsx` initializes the app, resolves the current user from Supabase, then renders providers and router.
  - Global providers: `AlertProvider` and `ProgressProvider`.
- **Routing and page shell**
  - `src/app.jsx` defines route structure and shares app-level state via `Outlet` context.
  - Main route groups include start page, dashboard, classroom, metrics, progress, export, and course creation.
- **Domain/data model**
  - `src/model.ts` defines core types (`User`, `CatalogEntry`, `Enrollment`, `LearningSession`).
  - `src/course.js` loads course content from GitHub (`course.json`) and maintains topic/module traversal logic.
- **Service layer**
  - `src/service/service.ts` is a singleton that combines Supabase auth/data access, GitHub API operations, and Edge Function calls (Canvas/Gemini).
- **Feature orchestration**
  - `src/hooks/useCourseOperations.jsx` is the main orchestration module for learning flow, content editing, GitHub commits, Canvas export, analytics/progress, and AI-assisted actions.
- **Rendering/content system**
  - Markdown content is rendered with `react-markdown`, `remark-*` plugins, Mermaid support, and custom component overrides in `src/components/Markdown.jsx` and `src/components/MarkdownStatic.jsx`.

## Potential Security Problems

### 1. High: Unsanitized raw HTML rendering from course content
- `src/components/Markdown.jsx:217` and `src/components/MarkdownStatic.jsx:149` enable `rehypeRaw`, which permits raw HTML embedded in markdown.
- If untrusted or compromised content reaches markdown, this increases XSS risk.
- Recommendation:
  - Remove `rehypeRaw` where possible.
  - If raw HTML is required, add strict sanitization (`rehype-sanitize` with an allowlist schema).
  - Treat course markdown as untrusted input.

### 2. High: GitHub PAT handling in plaintext UI and role settings
- Token input is plain text (`src/settings.jsx:300`, `src/views/courseCreation/courseCreationForm.jsx:167`).
- Token values are persisted in role settings (`src/settings.jsx:108`, `src/settings.jsx:146`, `src/settings.jsx:160`) and then reused broadly.
- Recommendation:
  - Use `type="password"` with show/hide control.
  - Move token custody server-side (Edge Function/vault) and store only a short-lived reference on the client.
  - Minimize token replication across user role records.

### 3. Medium: Broad localStorage wipe on logout
- `src/service/service.ts:407` runs `localStorage.clear()`.
- This removes unrelated keys under the same origin and can cause cross-feature/session side effects.
- Recommendation:
  - Remove only app-scoped keys with a prefix strategy (for example `masteryls:*`).

### 4. Medium: Supabase config key committed directly in repo
- `config.js:3-4` contains live URL/key values in source.
- Supabase anon keys are public by design, but embedding fixed credentials in source reduces operational hygiene and environment separation.
- Recommendation:
  - Move to environment-based config (`import.meta.env`) and keep `config.js` out of committed secrets patterns.

## Refactoring Suggestions

### 1. Split `useCourseOperations` into focused modules
- `src/hooks/useCourseOperations.jsx` is ~970 lines and mixes many concerns.
- Suggested split:
  - `useAuthOperations`
  - `useCourseStructureOperations`
  - `useTopicContentOperations`
  - `useCanvasExportOperations`
  - `useProgressOperations`
- Benefits: easier testing, lower regression risk, clearer ownership boundaries.

### 2. Separate API adapters from domain orchestration
- `service.ts` currently contains auth, database queries, GitHub file ops, and external integrations.
- Introduce adapter modules (`supabaseClient`, `githubClient`, `canvasClient`, `geminiClient`) and keep `service` as composition/orchestration.

### 3. Strengthen async consistency and error handling
- `useCourseOperations.logout` does not await `service.logout()` (`src/hooks/useCourseOperations.jsx:32`).
- `service.saveEnrollment(enrollment)` is called without await in cached progress update (`src/hooks/useCourseOperations.jsx:648`).
- Recommendation: enforce explicit `await`/fire-and-forget conventions with centralized error logging and user feedback.

### 4. Standardize timestamp field usage
- Progress records are queried/sorted by `createdAt` (`src/service/service.ts:642`, `src/service/service.ts:649`), but reducers compare `creationDate` (`src/hooks/useCourseOperations.jsx:692`, `src/hooks/useCourseOperations.jsx:704`).
- Recommendation: normalize to one field name across DB types, service mapping, and UI.

### 5. Tighten role mutation implementation
- `removeUserRole` builds a second query but never executes it (`src/service/service.ts:331-334`), suggesting dead or incomplete logic.
- Recommendation: remove dead branch and make null/non-null object handling explicit with one executed query.

## Things Done Well
- Clean route composition and shared context setup in `src/app.jsx`.
- Good feature coverage with many Playwright tests (`tests/*.spec.ts`).
- Consistent domain modeling (`User`, `Enrollment`, `CatalogEntry`, `LearningSession`) in `src/model.ts`.
- Thoughtful UX infrastructure for alerts/progress (`AlertContext`, `ProgressContext`).
- Practical integration pattern using Supabase Edge Functions for Canvas/Gemini rather than direct client secrets.

## Things That Should Be Improved
- Reduce centralization risk in `useCourseOperations.jsx` and `service.ts`.
- Harden markdown rendering path against XSS.
- Redesign GitHub token lifecycle and storage to avoid plaintext handling and broad role replication.
- Replace global localStorage clearing with app-key targeting.
- Fix timestamp-field mismatch and async gaps to improve data integrity.
- Add focused unit tests around service methods and hook logic (current testing is strong at E2E, weaker for isolated logic).

## Priority Order
1. Secure markdown rendering (`rehypeRaw` sanitization/removal).
2. Rework GitHub token handling (server custody + masked input).
3. Fix data correctness issues (`creationDate` vs `createdAt`, role deletion query).
4. Refactor `useCourseOperations` into smaller testable hooks.
5. Improve config/env and storage hygiene.
