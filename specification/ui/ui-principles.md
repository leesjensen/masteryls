# UI Principles Specification

## Scope
This document defines the product-level UI principles that lock look-and-feel independent of implementation framework.

It is normative for:
- visual language
- interaction behavior
- layout behavior
- accessibility baseline

See also:
- `overview.md`
- `ui-contract-changelog.md` (canonical version)

## Visual Language
- Palette direction:
  - neutral surfaces (`white` + `slate/gray`) as baseline
  - amber as primary action/accent color
  - blue as secondary informational/action color
  - red reserved for destructive/error states
- Surface style:
  - rounded cards/panes, light border-first styling, subtle elevation
  - low-noise backgrounds; content remains the visual focus
- Density:
  - productivity-oriented density for classroom/editor screens
  - comfortable density for dashboard and settings forms
- Typography:
  - clear hierarchy with stable scale:
    - page title (`xl`)
    - section title (`lg`)
    - card/title (`md`)
    - body (`base`)
    - metadata/helper (`sm`/`xs`)
- Iconography:
  - outline-style icon set, consistent stroke weight
  - icons always paired with label or clear tooltip for ambiguous actions

## Layout Principles
- App structure:
  - fixed app bar + route content region
- Classroom structure:
  - `Course pane` + `Main pane` + `Discussion pane`
  - both side panes are resizable/collapsible
- Responsive behavior:
  - side panes may switch between split and overlay on narrow viewports
  - primary learning/editing task must remain uninterrupted on mobile

## Interaction Principles
- Predictability:
  - same action labels and placements across screens
  - avoid context-dependent control meaning changes
- Safety:
  - destructive actions require confirmation
  - unsaved state is always explicitly guarded
- Read-only semantics:
  - observer mode is visibly read-only and behaviorally hard-denied for writes
- Feedback:
  - explicit loading, empty, error, and success states for every major screen

## Accessibility Baseline
- Keyboard support for all primary actions and pane interactions.
- Visible focus indicators for interactive controls.
- WCAG AA contrast target for text and essential controls.
- Screen-reader labels for icon-only controls, pane toggles, and mode indicators.

## Governance Rules
- Any change to palette direction, typography scale, spacing rhythm, pane behavior, or component state semantics requires a UI spec update first.
- Experimental UI variants must be marked non-normative until promoted.

## Legacy Gaps Addressed
- Prevents feature-specific visual drift.
- Establishes one consistent read-only and feedback language across routes.
- Locks current MasteryLS visual identity without binding to a single CSS framework.
