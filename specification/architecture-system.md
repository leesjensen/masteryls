# System Architecture Specification

## Scope
This document defines the target system architecture for MasteryLS:
- runtime component boundaries
- integration boundaries
- data ownership and consistency rules
- cross-cutting security and observability behavior

It is aligned to:
- `app.md`
- `domain-model.md`
- `auth-authorization.md`
- `routing-state.md`
- `editor-github-authoring.md`
- `search-progress-metrics.md`

## Design Goals
- Keep architecture simple to operate and clear to reason about.
- Enforce server-side authorization and secret custody for all sensitive operations.
- Enforce API-mediated data access so browser clients never query operational DB tables directly.
- Separate canonical content storage (GitHub) from operational application data (Supabase).
- Support read-only observer mode via explicit actor/subject context.
- Make writes auditable and read models reproducible.

## Architecture Style
- Client: React SPA with route-driven feature views.
- Backend API boundary: Edge Functions / server API handlers.
- Backend platform: Supabase Auth + Postgres + RLS (behind the API boundary).
- External systems: GitHub (content), Canvas (LMS export), Gemini (AI).
- Integration pattern: browser never owns long-lived external secrets and never queries operational tables directly; protected app-data reads/writes execute through server API/integration boundary.
- Auth exception: browser uses Supabase Auth client SDK directly for OTP/session lifecycle only.

## Architectural Decision: API Boundary vs Direct Browser DB Access
Decision:
- Use API-mediated access for operational application data (`browser -> API/edge -> DB`), instead of direct browser table access with only public RLS enforcement.

Alternatives considered:
- Direct browser-to-DB access with RLS (`browser -> DB`).
- Hybrid access (some direct DB reads, API for writes/integrations).

Tradeoff summary:

| Option | Cost/latency | Security/policy consistency | Regeneration/governance |
|---|---|---|---|
| Direct browser -> DB | lower infra cost, fewer hops | weaker central policy composition; harder to enforce observer/session semantics uniformly | weaker contract boundary; more UI-coupled data logic |
| API-mediated (selected) | higher infra cost, extra hop/cold start risk | stronger centralized authz, actor/subject handling, auditing, idempotency | stronger machine-derivable contracts and cleaner architecture boundaries |

Why this was selected:
- Observer-mode semantics require consistent actor/subject resolution across all operations.
- Privileged workflows need uniform audit/event emission.
- GitHub/Canvas/Gemini operations are already server-bound; keeping data operations in the same boundary reduces split-brain logic.
- A single API contract surface is easier to regenerate from specification and to govern over time.

Performance/cost mitigations required:
- keep endpoints coarse enough to avoid chatty N+1 request patterns.
- use short-lived caching and revalidation for read-heavy payloads.
- colocate API execution and database region.
- use async job endpoints for long-running operations (export/reindex/repair).

## System Context
```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "lineColor": "#9ca3af", "primaryBorderColor": "#9ca3af", "secondaryBorderColor": "#9ca3af", "tertiaryBorderColor": "#9ca3af", "clusterBorder": "#9ca3af", "edgeLabelBackground": "#ffffff", "primaryTextColor": "#111827"}}}%%
flowchart LR
  U[User] --> B[Browser SPA]
  B --> H[Static Hosting]
  B --> AUTH[(Supabase Auth)]
  B --> F[Server API Boundary<br/>Edge Functions / API]
  F --> DB[(Supabase Postgres + RLS)]
  F --> AUTH
  F --> V[(Secret Vault / Credential Store)]
  F --> G[GitHub API]
  F --> C[Canvas API]
  F --> A[Gemini API]
```

## Container View (Runtime)
```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "lineColor": "#9ca3af", "primaryBorderColor": "#9ca3af", "secondaryBorderColor": "#9ca3af", "tertiaryBorderColor": "#9ca3af", "clusterBorder": "#9ca3af", "edgeLabelBackground": "#ffffff", "primaryTextColor": "#111827"}}}%%
flowchart TB
  subgraph Browser
    APP[App Shell + Router]
    VIEWS[Feature Views]
    OPS[Client Orchestration Hooks<br/>useCourseOperations + capability hooks]
    STORE[Session + Learning + UI State]
    CACHE[Client Cache<br/>Revalidated]
  end

  subgraph Platform
    DB[(Supabase Postgres + RLS)]
    AUTH[Supabase Auth]
    FX[Server API / Edge Functions]
  end

  subgraph External
    GH[GitHub]
    CV[Canvas]
    GM[Gemini]
  end

  APP --> VIEWS
  VIEWS --> OPS
  OPS --> STORE
  OPS --> CACHE
  OPS --> AUTH
  OPS --> FX
  FX --> DB
  FX --> AUTH
  FX --> GH
  FX --> CV
  FX --> GM
```

## Logical Layering
- Presentation Layer:
  - route views, panes, editor, interactions, metrics/progress dashboards.
  - governed by UI contract artifacts in `specification/ui/*` and screen manifests in `specification/ui/manifests/*`.
- Client Orchestration Layer:
  - hook facades (`useCourseOperations`, capability hooks) coordinate route/view workflows.
- Server Application Layer:
  - endpoint handlers and application services enforce authz, observer context, and domain operations.
- Domain Layer:
  - explicit domain entities from `domain-model.md` and policy decisions from `auth-authorization.md`.
- Infrastructure Layer:
  - Supabase adapters, integration adapters for GitHub/Canvas/Gemini, storage and cache adapters.

Rules:
- UI layer does not implement authoritative permission logic.
- Client orchestration calls API contracts only; it does not read/write operational tables directly.
- Browser-to-Supabase direct calls are limited to Auth SDK session/OTP flows.
- Server application layer resolves actor/subject context and executes server-authorized operations.
- Infrastructure layer is replaceable without changing domain contracts.

UI rendering boundary:
- application services return view models.
- UI components render from view models + screen manifests (slot/state/component allowlists).
- orchestration hooks coordinate data/actions; they are not the source of visual contract truth.

## Application Service Decomposition (Phased Migration Plan)
Current state:
- `useCourseOperations` is a broad compatibility facade spanning learning runtime, authoring, admin, export, AI, and analytics operations.

Target state:
- split into focused application services with explicit contracts:
  - `LearningRuntimeService`
  - `AuthoringService`
  - `AdminService`
  - `ExportService`
  - `AnalyticsService`
  - shared `AuthorizationContextService` (actor/subject resolution, including observer mode)
- React hooks become thin adapters over services:
  - `useLearningRuntime`, `useAuthoringActions`, `useAdminActions`, `useExportActions`, `useAnalyticsQueries`.

Migration phases:
1. Phase 0 - Stabilize Facade
- keep `useCourseOperations` public shape stable for existing views/tests.
- enforce centralized permission checks inside facade paths.
- add telemetry tags per operation family to baseline usage and failure patterns.

2. Phase 1 - Extract Pure Services
- move domain/application logic into framework-agnostic modules.
- keep hooks as orchestration adapters only.
- isolate external I/O adapters (Supabase, GitHub, Canvas, Gemini) behind interfaces.

3. Phase 2 - Introduce Capability Hooks
- add focused hooks for new/updated features; avoid adding new behavior to monolithic facade.
- route each capability hook to its corresponding service.
- retain facade as compatibility wrapper delegating to new services.

4. Phase 3 - Cutover And Deprecate
- migrate remaining call sites from `useCourseOperations` to capability hooks.
- mark facade APIs deprecated and remove once no call sites remain.
- enforce architectural lint/check rules preventing new cross-capability coupling.

Guardrails during migration:
- no behavior regression on authz boundaries, observer read-only enforcement, or audit emission.
- no client secret expansion; all sensitive integrations remain server-bound.
- preserve existing route contracts and UI behavior unless explicitly specified.
- require parity tests for each migrated capability before cutover.

Definition of done:
- `useCourseOperations` removed or reduced to a minimal compatibility shim with no business logic.
- all capability services have explicit input/output contracts and test coverage.
- actor/subject authorization context is shared and consistently applied across all services.

## Data Ownership Boundaries
- GitHub (canonical instructional content):
  - `course.json`
  - topic markdown/media assets
  - commit history/diffs
- Supabase DB (canonical operational data):
  - users, roles, observer delegations/sessions
  - enrollments, attempts, exam sessions, notes, activity events
  - search projection (`SearchDocument`) and derived read models
- Client local storage (non-authoritative preferences only):
  - pane layout
  - view preferences
  - per-user scoped transient discussion cache

## Core Runtime Flows

### Topic Read Flow
```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "lineColor": "#9ca3af", "primaryBorderColor": "#9ca3af", "secondaryBorderColor": "#9ca3af", "tertiaryBorderColor": "#9ca3af", "clusterBorder": "#9ca3af", "edgeLabelBackground": "#ffffff", "primaryTextColor": "#111827"}}}%%
sequenceDiagram
  participant U as User
  participant UI as Classroom UI
  participant OPS as Client Orchestration
  participant API as Server API Boundary
  participant DB as Supabase/RLS
  participant GH as GitHub

  U->>UI: Open /course/:courseId/topic/:topicId
  UI->>OPS: Resolve session + subject context
  OPS->>API: GET /courses/{courseId}/topics/{topicId}/content
  API->>DB: Load enrollment/visibility/roles
  API->>GH: Read course.json/topic markdown
  GH-->>API: Content + version marker
  API-->>OPS: Authorized content response
  OPS-->>UI: Rendered topic view model
```

### Topic Edit Commit + Search Index Update
```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "lineColor": "#9ca3af", "primaryBorderColor": "#9ca3af", "secondaryBorderColor": "#9ca3af", "tertiaryBorderColor": "#9ca3af", "clusterBorder": "#9ca3af", "edgeLabelBackground": "#ffffff", "primaryTextColor": "#111827"}}}%%
sequenceDiagram
  participant E as Editor
  participant UI as Editor UI
  participant OPS as Client Orchestration
  participant API as Server API Boundary
  participant GH as GitHub
  participant DB as Supabase

  E->>UI: Commit topic changes
  UI->>OPS: Validate + submit commit intent
  OPS->>API: Write request (authorized)
  API->>GH: Commit topic markdown/course.json
  GH-->>API: Commit SHA
  API->>DB: Emit content.updated event
  API->>DB: Incremental SearchDocument update (affected topic)
  DB-->>API: Index result
  API-->>OPS: Commit result + index status
  OPS-->>UI: Success (or warning if index update failed)
```

### Interaction Submission + Activity Pipeline
```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "lineColor": "#9ca3af", "primaryBorderColor": "#9ca3af", "secondaryBorderColor": "#9ca3af", "tertiaryBorderColor": "#9ca3af", "clusterBorder": "#9ca3af", "edgeLabelBackground": "#ffffff", "primaryTextColor": "#111827"}}}%%
sequenceDiagram
  participant L as Learner
  participant UI as Interaction UI
  participant OPS as Client Orchestration
  participant API as Server API Boundary
  participant DB as Supabase
  participant GM as Gemini

  L->>UI: Submit interaction
  UI->>OPS: Submission payload
  OPS->>API: POST /courses/{courseId}/topics/{topicId}/interactions/{interactionId}/attempts
  API->>DB: Persist InteractionAttempt
  API->>GM: Generate feedback
  GM-->>API: Feedback
  API->>DB: Append ActivityEvent + update derived views
  API-->>OPS: Grading result
  OPS-->>UI: Result + updated progress snapshot
```

## Security Architecture
- Identity and session:
  - Supabase OTP auth, server-validated session and scope checks.
- Authorization:
  - RLS + policy checks enforce read/write constraints.
  - observer mode switches subject context and hard-denies writes.
- Data access boundary:
  - browser clients never read/write operational tables directly.
  - API/edge layer is the only caller of protected table operations.
- Secrets:
  - GitHub/Canvas/AI credentials are server-custodied (`CredentialReference`); never exposed to client.
- Content safety:
  - markdown sanitization and protocol allowlists at render/export boundaries.
- Integration boundary:
  - external API calls requiring secrets run server-side.
  - deny-by-default endpoint authorization with auditable outcomes.

## Consistency And Freshness Model
- Canonical event timestamp: `createdAt`.
- Write operations are auditable and idempotency-aware where needed (export/index/repair flows).
- Optimistic concurrency required for authoring writes (base SHA/version checks).
- Content reads target latest default branch with explicit revalidation.
- Search index:
  - incremental update on successful topic create/edit commit.
  - full reindex is available as recovery.

## State Model Responsibilities
- Canonical server state:
  - identity, permissions, enrollments, attempts, notes, activity events, search docs.
- Canonical external content state:
  - GitHub course definition and topic assets.
- Client transient state:
  - currently loaded course/topic view model
  - UI-only preferences and pending editor drafts

## Observability
- Required audit event families:
  - auth, role/delegation, observer session, content updates, exports, reindex, privileged analytics reads.
- Correlation:
  - every privileged operation includes actor and (if applicable) subject user IDs.
- Operational telemetry:
  - integration latency/error categories (GitHub, Canvas, Gemini)
  - cache revalidation outcomes
  - index freshness lag metrics

## Deployment Topology (Target)
- Frontend SPA hosted as static assets.
- Supabase project provides Auth, Postgres, RLS, and Edge Functions.
- Edge Functions/API act as the boundary for all protected application data operations and secret-bound external operations.
- Environment-specific config contains only non-secret public values in frontend runtime config.

## Legacy Gaps Addressed
- Removes client-side external secret custody and token-in-role-settings behavior.
- Replaces mixed direct external calls with a consistent server integration boundary for sensitive operations.
- Formalizes actor/subject context for observer-mode and cross-user reporting reads.
- Makes post-commit search indexing behavior explicit and recoverable.
- Enforces consistent auditability across content, admin, and analytics workflows.
