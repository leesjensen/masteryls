# UI Overview Specification

## Scope
This document provides a top-level map of the application UI:
- route-to-screen structure
- shared screen state model
- classroom pane layout model
- view-model rendering architecture

It is aligned to:
- `ui-goals.md`
- `ui-conformance-baseline.md`
- `ui-principles.md`
- `ui-tokens.md`
- `ui-components.md`
- `../component-contract-schemas.md`
- `ui-screens.md`
- `../view-model-schemas.md`
- `../routing-state.md`
- `../architecture-system.md`

Canonical version source:
- `ui-contract-changelog.md`

## Route To Screen Map
```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "lineColor": "#9ca3af", "primaryBorderColor": "#9ca3af", "secondaryBorderColor": "#9ca3af", "tertiaryBorderColor": "#9ca3af", "clusterBorder": "#9ca3af", "edgeLabelBackground": "#ffffff", "primaryTextColor": "#111827"}}}%%
flowchart TB
  R0["/"] --> S0[StartScreen]
  R1["/about"] --> S1[AboutScreen]
  R2["/dashboard"] --> S2[DashboardScreen]
  R3["/course/:courseId/topic/:topicId"] --> S3[ClassroomScreen]
  R4["/metrics"] --> S4[MetricsScreen]
  R5["/progress"] --> S5[ProgressScreen]
  R6["/courseCreation"] --> S6[CourseCreationScreen]
  R7["/courseExport"] --> S7[CourseExportScreen]
  R8["/error/:code?"] --> S8[ErrorScreen]
```

## Shared Screen State Model
All screens should implement explicit state handling. Not all screens use every state.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "lineColor": "#9ca3af", "primaryBorderColor": "#9ca3af", "secondaryBorderColor": "#9ca3af", "tertiaryBorderColor": "#9ca3af", "clusterBorder": "#9ca3af", "edgeLabelBackground": "#ffffff", "primaryTextColor": "#111827"}}}%%
stateDiagram-v2
  [*] --> loading
  loading --> ready
  loading --> error
  ready --> empty
  ready --> readonlyObserver
  ready --> editorMode
  empty --> ready
  error --> loading
```

## Classroom Layout Model
```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "lineColor": "#9ca3af", "primaryBorderColor": "#9ca3af", "secondaryBorderColor": "#9ca3af", "tertiaryBorderColor": "#9ca3af", "clusterBorder": "#9ca3af", "edgeLabelBackground": "#ffffff", "primaryTextColor": "#111827"}}}%%
flowchart LR
  TB[TopToolbar] --> CP[CoursePane]
  TB --> MP[MainPane]
  TB --> DP[DiscussionPane]

  CP -. resize/collapse .- MP
  DP -. resize/collapse .- MP
  CP --> TABS1[Tabs: Topics/Search/Settings]
  DP --> TABS2[Tabs: Discuss/Notes]
```

Behavior notes:
- `CoursePane` and `DiscussionPane` share consistent resize/collapse behavior.
- In observer mode, panes remain visible but write controls enter `readonly`.
- On narrow viewports, side panes may switch from split to overlay.

## View-Model Rendering Architecture
```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "lineColor": "#9ca3af", "primaryBorderColor": "#9ca3af", "secondaryBorderColor": "#9ca3af", "tertiaryBorderColor": "#9ca3af", "clusterBorder": "#9ca3af", "edgeLabelBackground": "#ffffff", "primaryTextColor": "#111827"}}}%%
flowchart LR
  AS[Application Services] --> VM[Screen ViewModel]
  HK[Capability Hooks] --> VM
  VM --> SR[Screen Renderer]
  MF[ui-manifest.json] --> SR
  SR --> CMP[Approved UI Components]
  TK[UI Tokens] --> CMP
```

Rules:
- Services and hooks produce data/actions; they do not define visual structure.
- Screen renderer composes UI strictly through manifest slots and approved components.
- Components render semantic states (`loading`, `empty`, `error`, `readonlyObserver`, `editorMode`) from view-model fields.

## Relationship To Other UI Specs
- `ui-principles.md`: visual and interaction intent.
- `ui-tokens.md`: canonical token definitions.
- `ui-components.md`: allowed component set and state contracts.
- `../component-contract-schemas.md`: machine-validated component prop/state/slot registry.
- `ui-screens.md`: route-level slot/state matrix + manifest references.
- `../view-model-schemas.md`: machine-validated payload contracts for each screen/state.

## Legacy Gaps Addressed
- Gives one canonical map for how screens relate to routes and states.
- Makes UI derivation from spec clearer for humans and tooling.
- Reduces ambiguity between behavior orchestration and visual composition boundaries.
