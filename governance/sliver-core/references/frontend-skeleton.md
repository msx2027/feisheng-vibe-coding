# Frontend Skeleton

Use `前端骨架` when the project needs foundation-level frontend structure, skeleton repair, design-system consolidation, or a minimal runnable frontend base. Ordinary local frontend changes stay in `开发执行`.

## Design-First Gate

Frontend architecture starts with design direction, not page generation.

This foundation gate applies when creating or repairing the frontend skeleton, introducing a new visual system, or resolving a proven frontend-architecture conflict. An ordinary page, component, copy, local interaction, or style change with a known token/component owner stays in `开发执行` and does not rerun technical selection or the full skeleton gate.

Do not build pages, layouts, or component variants until these are written into frontend truth documents:

- Design priority: what the product should feel like for its users.
- Visual style: information density, spacing, typography, color direction, component shape, interaction tone, and page rhythm.
- Reference analysis: what to learn from references and what not to copy.
- UI library or component strategy.
- Design tokens: named rules for color, font, spacing, radius, shadow/elevation, layout width, breakpoints, and state styles.

If any of these are missing, stop before implementation and run a frontend architecture clarification. A non-technical user should see one recommended style route, not several equal visual directions.

Token-first means new pages and components must consume agreed tokens instead of inventing page-local colors, spacing, font sizes, border radii, shadows, or status colors.

## Before Coding

Define and write to truth documents:

- Product visual style.
- Main user flow and first visible route.
- Active technical-selection truth and its selected frontend framework/platform plus architecture fit.
- UI component library or component strategy.
- Directory structure.
- Module boundaries.
- Component reuse rules.
- Design tokens.
- Internationalization rule if needed.
- Theme rule if needed.
- First-stage scope and validation.

## Design Style

Ask for references when the user has no vocabulary for style. Analyze references for visual language, information density, spacing, typography, component patterns, and whether they fit the product.

Do not copy a reference product directly.

Output one recommended style route:

- Recommended visual direction.
- Why it fits this product and user group.
- What reference patterns are useful.
- What reference patterns are rejected.
- How the style will be expressed through tokens and components.
- What must not be done, such as mixing multiple visual systems or changing style per page.

Do not start with a generic "modern/simple/clean" answer unless it is translated into concrete token and component decisions.

## Token Truth

Frontend architecture truth must define the minimum token set before skeleton code:

- Color tokens: background, surface, text, border, primary action, secondary action, danger, success, warning, disabled, focus.
- Typography tokens: font family, page title, section title, body, caption, button, table/list text.
- Spacing tokens: page padding, section gap, card/list gap, form gap, inline gap.
- Shape tokens: radius, border, shadow/elevation.
- Layout tokens: content width, sidebar/header height, grid/list density, responsive breakpoints.
- State tokens: hover, active, selected, loading, empty, error, disabled.

For existing projects, first find the current token or style owner. If tokens do not exist, create a minimal token truth before consolidating pages. Do not silently create a second token system.

## Framework And UI Library

Explain in plain language:

- Framework controls project structure and runtime.
- UI library controls common interface components.
- Styling utilities and raw CSS approaches are implementation tools, not design truth by themselves.

The frontend skeleton consumes the framework, platform, UI/component base, and architecture boundaries already selected by `tech-stack.md`. Do not compare or choose a second frontend stack here. If the decision is missing or current evidence proves a conflict, return to `技术选型` with that evidence; never ask the non-technical user to choose a framework.

Use the selected framework's native routing, rendering, state, data-fetching, error, build, and testing conventions unless the joint decision explicitly records a proven local exception.

If the UI library lacks a project-specific component, build a business component on top of the chosen UI library and design tokens. Do not casually abandon the UI library or mix multiple component systems because one screen is inconvenient.

If a low-level or utility-first styling route is used, it must be governed by the frontend truth document:

- Tokens are defined before page work.
- Component owner and theme/style entry point are explicit.
- Page-local one-off visual values are forbidden unless they become new tokens.
- Reusable components state which tokens they consume.
- Validation checks that new screens do not introduce a second visual system.

Do not repeat candidate comparison or technology-selection rationale in frontend architecture truth. Once materialized, frontend architecture truth is the single owner of concrete token, component, route, state, request, accessibility, responsive, and frontend-validation placement. The project-level `architecture.md` keeps only the macro client/process boundary plus a link to this detail owner; it must not copy these fields as a second truth.

## UI Delivery Shape

For user-visible changes, classify each supplied screenshot, mockup, existing screen, or explicit visual correction before implementation. It may be a finished-product source, a structural source of truth, a style reference, or diagnostic evidence. If more than one role is reasonable and the choice changes the visible result, return to the Intent Confirmation Gate; never assume permission to redesign.

Responsive adaptation preserves delivery semantics. It may change measurements, wrapping, density, and controls required by the confirmed device constraints, but it does not grant automatic permission to redesign information hierarchy, module order, navigation model, interaction steps, business meaning, or visual direction. If a device constraint makes the locked result infeasible, report the exact visible trade-off and get confirmation before changing it.

A local UI correction keeps unchanged regions unchanged. Reuse current components, tokens, layout, interaction patterns, loading/error states, i18n, and accessibility constraints. Do not turn a spacing, clipping, edge, or mobile-only correction into a whole-page redesign or a second component system.

## UI Lifecycle Boundary

This file owns the frontend foundation: layout width, tokens, components, themes, breakpoints, accessibility, and framework placement. `ui-design-lifecycle.md` owns project-aware prototype generation, versioned approval truth, design decomposition, asset boundaries, semantic design-to-code implementation, and fidelity validation.

When a skeleton task produces its first visual prototype, pass that artifact through the UI lifecycle rather than leaving it in chat or treating it as automatic implementation authority. Existing pages and foundation truth constrain the prototype; an approved prototype does not create a second component, token, or theme system.

## Structure Rules

The frontend skeleton should define:

- Where pages/routes live.
- Where shared components live.
- Where API calls live.
- Where state management lives when needed.
- Where utilities live.
- Where styles and tokens live.
- Where text/i18n resources live when needed.
- How modules such as login, user, order, content, and settings are separated.
- When similar UI should become a reusable component.

Rule of thumb: if a UI structure appears more than twice and is meaningfully similar, consider a reusable component.

Any reusable component must state which tokens it consumes. If it needs a new token, update the token truth first.

## Minimal Runnable Skeleton

The first frontend skeleton should only prove the structure:

- App starts.
- One route/page opens.
- Routing is clear.
- UI library is connected.
- Tokens/theme are available.
- Base layout exists.
- Common components have initial versions.

Do not build all pages in the skeleton stage.

Do not generate pages horizontally one after another before the structure is proven. The skeleton stage proves the rules future pages must follow.

## Existing Project Repair

For existing frontend:

- Identify inconsistent UI patterns.
- Identify repeated components.
- Identify hard-coded colors, spacing, font sizes, and text.
- Identify module boundary problems.
- Propose consolidation in the owner layer.
- Avoid rewriting all pages unless the user approves.

## Validation

Collect evidence:

- Install/start command.
- Local URL or build output.
- Screenshot or visible behavior when possible.
- Files defining tokens, theme, layout, routing, and components.
- The confirmed delivery-shape contract and before/after evidence for its changed and unchanged surfaces.
- Evidence that at least one real route/page and common component consume the token system.
- Evidence that no new page-local visual system was introduced.
- Known unverified items.
- Git checkpoint readiness after the skeleton is proven.
