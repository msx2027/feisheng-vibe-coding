# UI Design Lifecycle

Use this owner when work generates, revises, approves, or implements a UI design, screenshot, mockup, Figma surface, or other visual prototype. It owns the path from project-aware design to semantic production UI. It does not replace the frontend foundation owned by `frontend-skeleton.md`, the delivery-shape contract owned by `engineering-execution.md`, or project truth-root selection owned by `project-flow.md`.

Choose one operation from the requested result:

- `prototype`: create or revise a project-aware visual prototype and make it durable truth.
- `implement`: turn one approved prototype into semantic, reusable, theme-aware production UI.

An ordinary local spacing, copy, clipping, or state correction with no new design artifact may stay on the lightweight path owned by `engineering-execution.md` without materializing a new prototype. Any new or materially changed visible element still consumes Delivery Shape Lock v3 before code. Skipping prototype generation does not bypass that contract. Once the task generates a design artifact or treats one as the implementation source, this lifecycle also applies.

## Project UI Context Gate

No UI design may begin in isolation from the project that will receive it.

For an existing project, inspect the smallest sufficient existing project UI truth before generating or revising a prototype:

- current content width, layout shell, grid, header, sidebar, and full-bleed rules;
- design tokens for color, typography, spacing, radius, elevation, focus, and state;
- shared components, business components, icon library, and asset conventions;
- theme and responsive behavior, breakpoints, density, i18n, and accessibility;
- the target page, adjacent pages, loading/empty/error states, and current interaction patterns;
- active design truth, approved prototypes, and the project's internal truth index.

Record real file paths or runtime evidence. A screenshot, chat attachment, generated mockup, or remembered convention is not a substitute for reading the current owners.

Consume the baseline decision and evidence owned by `engineering-execution.md`, including its UX judgment, `sliver-delivery-shape-lock/v3` record, concrete same-role mature surface, or recorded finding that no comparable surface exists. When no comparable surface exists but stable visual owners do, form one reviewable visual target from those constraints. Only when neither a comparable surface nor stable visual direction exists should prototype exploration present materially distinct options. Prototype work adds versioned design evidence and project-constraint review; it does not create a second baseline, user-journey, mature-pattern, or information-architecture owner.

For a new project with no UI truth, establish only the minimum visual foundation needed by the first usable loop: product feel, content width, core tokens, typography, spacing, responsive rule, theme rule, and the first shared primitives. Do not invent a complete design system from one screen or start generating unrelated pages horizontally.

If current project truth is missing or contradictory, stop at that exact owner gap. Do not silently create a second layout, token, component, icon, or theme system.

## Prototype Operation

Reconstruct the visible result before drawing:

- target user and task;
- page, region, states, and device classes;
- information hierarchy and interaction steps;
- unchanged surfaces and explicit non-goals;
- reference role: finished-product source, structural source of truth, style reference, or diagnostic evidence;
- project constraints that the prototype must consume.

Generate the prototype from this context, then run project-constraint review before requesting approval. The review must compare the output to the current layout, tokens, components, assets, themes, breakpoints, adjacent pages, and accessibility expectations.

An image-generation output is a draft artifact, not production UI and not approval evidence by itself.

## Prototype Truth Gate

A prototype cannot remain only in chat, a tool session, an external temporary export, or an unindexed asset directory. Materialize it under the selected project truth root. If the project already has an internal-doc convention, follow it. If no convention exists, `dev-docs/` is absent, and it is not occupied by unrelated material, an authorized UI prototype request authorizes creating `dev-docs/design/` without a second directory-choice question. Ask only when the path would conflict with an existing convention, occupied directory, privacy or Git boundary, or external delivery requirement.

The preferred shape is `dev-docs/design/` when `dev-docs/` is the selected or applicable default root. When the narrow exception creates a previously absent `dev-docs/`, create the minimal `dev-docs/README.md` root index as well as the design subtree so the new truth is discoverable. When a root index already exists, merge only the design-truth link into it; do not replace its structure or content.

```text
dev-docs/
  README.md
  design/
  README.md
  prototypes/
    <feature>/
      prototype.md
      v001/
        <only real artifacts listed by the manifest>
```

Use `assets/project-design/` as the materialization template. Do not manufacture placeholder images, device classes, states, themes, or asset directories. Create only artifacts that are applicable to the requested product surface and came from real prototype output.

`design/README.md` is the index. Each feature's `prototype.md` is the only state owner and records:

- the lifecycle control fields defined by the Schema And Transition Owner below;
- active, approved, and implementation version ownership, approval evidence, and source request;
- project UI sources and constraint-review result;
- component reuse map, asset boundary map, theme/responsive obligations, and validation evidence.

## Schema And Transition Owner

This section is the single owner of the UI prototype schema, field meanings, enums, eligibility rules, and transitions. Project-flow insertion text, indexes, constitutions, and materialization templates consume this contract; they must not redefine it.

The schema is `sliver-ui-prototype/v2`:

- `active_version`: the existing `vNNN` directory currently being drafted or reviewed. `prototype_status` belongs only to this version.
- `prototype_status`: `draft | in_review | approved | rejected | superseded` for the exact `active_version`.
- `approved_version`: `pending` or one immutable version that completed the recorded approval transition. It may differ from `active_version` when a newer revision is being explored.
- `approval_mode`: `pending: <reason> | explicit: <evidence-ref> | continuous: <original-request-evidence-ref>` for the exact `approved_version`.
- `approval_evidence`: `pending` or a version-scoped record containing the approved version, durable authorization reference, compatible constraint-review reference, and recorded timestamp. The invariant is: approval evidence is version-scoped and cannot authorize another version.
- `implementation_version`: `pending` or the exact `approved_version` selected for implementation. `implementation_status` belongs only to this version.
- `implementation_status`: `not_started | in_progress | verified | partial | blocked` for the exact `implementation_version`; before one is selected it remains `not_started` with `implementation_version: pending`.

Every version history row owns that version's artifact manifest, constraint review, approval record, and implementation linkage. The artifact manifest is the only artifact inventory. Each entry records surface, state, viewport, theme, path, and SHA-256. Use `not_applicable` only for a dimension that genuinely does not apply; do not invent desktop/mobile pairs, themes, device classes, or states to fill a template. Manifest paths must stay inside the version directory, and the digest must match the recorded file.

Allowed transitions are:

1. Create or revise: create the next immutable directory, set it as `active_version`, set its `prototype_status` to `draft`, and leave any earlier `approved_version` and `implementation_version` explicit and unchanged.
2. Request review: change only the active version from `draft` to `in_review` after its real artifacts, manifest, context, and constraint-review evidence exist.
3. Approve: after compatible constraint review, atomically set the active version to `approved`, bind `approved_version`, `approval_mode`, and version-scoped `approval_evidence` to that same version, and keep implementation unstarted. If this replaces an earlier approved version, retain its immutable evidence and mark only its version-history row `superseded`; do not move an existing `implementation_version`. Explicit and continuous authorization use this same transition.
4. Begin implementation: bind `implementation_version` to the exact `approved_version`, then change only that version's `implementation_status` to `in_progress`.
5. Close implementation: change that implementation version to `verified`, `partial`, or `blocked` from fresh evidence; a later draft does not move this status to itself.
6. Reject or supersede: record the reason against the affected version. Superseding an old approved version requires a newly approved replacement; creating a draft alone does not revoke or inherit approval.

Only the recorded `approved_version` can authorize implementation. An approved version must not be overwritten; create the next vNNN directory for every revision and retain earlier evidence. A draft, in-review, rejected, superseded, or merely newer image is not an implementation source.

If the user explicitly asks to design and implement without an intermediate pause, the original request may be recorded as continuous authorization only when it already bounds the visible scope and non-goals. Continuous authorization still requires a versioned prototype, project-constraint review, approval evidence, semantic implementation, and fresh validation. The invariant is: continuous authorization must use the same recorded approval transition as explicit authorization; it is not an alternate eligibility path.

Continuous mode never means “implement while approval is pending.” After the active version exists and project-constraint review is `compatible`, perform the schema-owned atomic approval transition in `prototype.md` before code. Then bind `implementation_version` before changing implementation status. If review finds a material conflict, do not transition; keep approval pending and ask the one product-visible question.

## Constraint Resolution And Questions

The approved prototype owns the target region's visual structure and intent. The current project owns production constraints, reusable components, tokens, themes, responsive semantics, accessibility, and runtime behavior. Satisfy both whenever they are compatible.

Resolve compatible constraints without asking the user. For example, a full-bleed background may span the viewport while business content keeps the width defined by the current layout owner or token. Reusing the current Button variant, semantic tokens, breakpoint behavior, or theme mechanism does not require confirmation when the materially visible result remains the same. Never turn a value from a user example or reference image into a project default.

Ask one product-visible question only when there is a material conflict: both truths cannot be satisfied, and the available choices produce a materially different user-visible result. State the visible trade-off, unchanged areas, recommendation, and risk. Do not ask the user to choose imports, file types, CSS techniques, component placement, or other implementation details.

## Implement Operation

Before code, verify that the selected source is the recorded `approved_version`, bind `implementation_version` to that exact version, then read the current implementation owners again. A design image does not override newer project truth.

Run this sequence:

```text
approved prototype
  -> current project constraint audit
  -> design decomposition
  -> component reuse map
  -> asset boundary map
  -> semantic implementation
  -> fidelity and drift validation
```

## Design Decomposition Gate

Decompose the approved visual into production responsibilities before writing UI code.

The component reuse map records each visual structure, its existing project component or owner, whether it is reused or extended, and why a new component is genuinely required. Use this priority:

1. Existing business component.
2. Existing shared or UI-library component.
3. A project-conforming variant of an existing component.
4. A new component only when no current owner can express the required behavior.

Carry the dependency-direction decision owned by `engineering-execution.md` into the reuse map and show how each new or extended component conforms to it. When controlled shared evolution is already authorized there, also carry its affected-consumer map, migration boundary, regression evidence, and rollback boundary into decomposition; do not redefine the universal dependency rule here.

The asset boundary map records each visual element and its correct production form:

| Visual element | Production form |
| --- | --- |
| Headings, body text, labels, prices, and button text | real DOM text using project typography and i18n truth |
| Buttons, forms, navigation, tables, tabs, dialogs, and cards | semantic project components with keyboard and accessibility behavior |
| Existing icons | current Icon component or project SVG asset |
| Genuinely new simple pictogram that the current icon system cannot express | project-conforming standalone SVG, with no captured background or neighboring pixels |
| Irreducible illustration or decoration that should not be CSS/token-driven | project-conforming standalone SVG or a transparent WebP/PNG when raster detail requires it |
| Photography | AVIF, WebP, or JPEG according to project convention |
| Gradient, radius, border, shadow, spacing, and layout | CSS and design tokens |

Never use a whole screenshot as the implemented page, screenshot slicing as a component system, transparent hotspots over a flattened image, or text and controls baked into an image. Never ship a white-box crop or nearby screenshot fragments as an icon. A whole image is allowed only when the confirmed product result is itself non-interactive static artwork, such as a poster, and the Delivery Shape Lock records that role.

Do not turn every visible element into an independent transparent asset. Prefer the current icon system, semantic components, CSS, and tokens. A separate transparent raster/vector file is required only when the element is genuinely an asset after decomposition; record its project convention, source/provenance, crop boundary, and license or generation evidence in the asset boundary map.

Implementation must preserve real states: loading, empty, error, disabled, hover, focus, selection, validation, and retry where applicable. Theme and responsive work must use semantic tokens and current breakpoint rules; a light-only design does not authorize light-only constants in a themed project.

Real DOM text and i18n implementation do not authorize meaning-changing product claims, promises, policy, or risk disclosure. Consume the visible-copy decision and source evidence owned by `engineering-execution.md` when that boundary is active, while leaving routine labels, concise help, and recovery text to scoped implementation judgment; do not redefine copy eligibility in this lifecycle.

## Design Fidelity Check

Implementation is not accepted from screenshot similarity alone. Collect evidence across every applicable plane:

1. Visual composition: hierarchy, dimensions, spacing, alignment, typography, color, and responsive composition.
2. Real semantics: real DOM, keyboard behavior, labels, focus, ARIA, and functional controls.
3. Project reuse: components, tokens, icons, layout owners, framework conventions, and absence of a parallel system.
4. Asset boundaries: correct format, transparency, cropping, resolution, and no baked text or controls.
5. Theme and responsive behavior: every supported theme and affected device class.
6. Interaction states: happy path plus loading, empty, error, disabled, hover, focus, retry, and refresh when relevant.

Use the acceptance phase of Delivery Shape Lock v3. Bind each reference and candidate screenshot pair to the same viewport, state, and theme; collect a DOM or accessibility snapshot, applicable keyboard/focus interaction trace, changed-region evidence, unchanged-region evidence, and independent review. Pixel comparison can support the visual plane but cannot prove semantics, reuse, themes, interactions, data truth, or accessibility. Then run the separate Visual Drift Check to prove that unchanged regions and the pre-implementation lock did not drift.

## Hard Stops

Stop design or implementation when any item is true:

- existing project UI truth was not inspected;
- a generated prototype is not indexed and versioned under the selected truth root;
- implementation points to anything other than the recorded approved version;
- an approved artifact is about to be overwritten;
- design-to-code implementation would begin while component or asset boundaries are unresolved;
- the implementation would flatten interactive UI into images;
- a material conflict remains unresolved;
- theme, responsive, semantic, or required state evidence is missing while completion is being claimed.
