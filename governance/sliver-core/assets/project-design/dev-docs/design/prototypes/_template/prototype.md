# UI Prototype: <feature-name>

Schema owner: `references/ui-design-lifecycle.md`. This file is one `sliver-ui-prototype/v2` instance; it consumes the owner contract and does not define enums or transitions.

## Prototype Control

- schema: `sliver-ui-prototype/v2`
- feature: `<feature-name>`
- active_version: `v001`
- prototype_status: `draft`
- approved_version: `pending`
- approval_mode: `pending: <why approval is not yet recorded>`
- approval_evidence: `pending`
- implementation_version: `pending`
- implementation_status: `not_started`
- source_request: `<durable request reference>`
- last_updated: `<YYYY-MM-DD>`

Before implementation, apply the schema owner's atomic approval transition to one exact version. The resulting instance must include together:

- prototype_status: `approved`
- approved_version: `<active_version>`
- approval_mode: `<evidence-bearing mode for this version>`
- approval_evidence: `<approved version + authorization ref + compatible review ref + timestamp>`
- implementation_version: `pending`
- implementation_status: `not_started`

Then bind `implementation_version` to that exact `approved_version` before code. Continuous work uses this same recorded transition; it cannot inherit approval, bypass a material conflict, or reuse another version's evidence.

## Product And UI Context

- Target user and task: `<who does what>`
- Visible scope: `<region and outcome>`
- Applicable surfaces and required states: `<actual product surfaces and states; do not invent device pairs>`
- Unchanged surfaces: `<what must remain visually and behaviorally unchanged>`
- Non-goals: `<what must not be introduced>`
- Reference role and authority: `<finished-product source | structural truth | style reference | diagnostic evidence; what it may override>`
- Adjacent page evidence: `<paths or runtime evidence>`
- Product truth sources: `<links under the active truth root>`
- i18n and accessibility: `<locales, text expansion, directionality, keyboard, focus, labels, contrast, motion>`

## Current Project UI Truth

| Constraint | Current owner or evidence | Prototype decision | Status |
| --- | --- | --- | --- |
| Layout and content width | `<file/path>` | `<decision>` | `<owner-schema source status>` |
| Tokens and typography | `<file/path>` | `<decision>` | `<owner-schema source status>` |
| Components and icons | `<file/path>` | `<reuse or gap>` | `<owner-schema source status>` |
| Asset convention and provenance | `<format, directory, source, license/generation evidence>` | `<reuse, generate, or not applicable>` | `<owner-schema source status>` |
| Themes | `<file/path>` | `<supported theme behavior>` | `<owner-schema source status>` |
| Responsive/layout surfaces | `<file/path>` | `<applicable surfaces only>` | `<owner-schema source status>` |
| i18n and accessibility owners | `<file/path>` | `<obligations>` | `<owner-schema source status>` |

## Version History

| Version | Status | Manifest | Basis and change | Constraint review | Approval record | Implementation linkage |
| --- | --- | --- | --- | --- | --- | --- |
| `v001` | `draft` | `below` | `<initial target>` | `pending` | `pending` | `pending` |

Never overwrite an approved version. A newer active draft does not inherit, revoke, or change the approved or implementation version.

## Artifact Manifest

List only real, applicable outputs inside the current version directory. Hash the final bytes after export. Use `not_applicable` only when that dimension genuinely has no meaning for the product surface.

| Version | Surface | State | Viewport | Theme | Path | SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| `v001` | `<surface>` | `<state>` | `<viewport or not_applicable>` | `<theme or not_applicable>` | `v001/<real-file>` | `<64 lowercase hex>` |

## Project-Constraint Review

- Review result: `<owner-schema review result>`
- Compatible constraints: `<evidence>`
- Material conflicts: `<visible conflict or none>`
- Resolution: `<project-conforming decision or user-confirmed exception>`
- Blocking question: `<one decision-changing product question or none>`

## Implementation Handoff

- Implementation source: `<implementation_version or blocked>`
- Component-reuse map: `<path or inline evidence>`
- Asset-boundary map: `<element, production form, project convention, provenance/license, crop/transparency evidence>`
- Theme and responsive obligations: `<applicable surfaces and themes>`
- Semantic interaction obligations: `<real DOM/control behavior>`

## Validation Evidence

- Visual composition: `未验证`
- Real semantics and interaction: `未验证`
- Component and token reuse: `未验证`
- Asset format, provenance, transparency, and boundaries: `未验证`
- Theme and responsive behavior: `未验证`
- Applicable states and unchanged surfaces: `未验证`

Completion requires fresh evidence for every applicable plane. Screenshot similarity alone is insufficient.

## Unverified And Stop Conditions

- Unverified: `<current unknowns>`
- Stop when: `<material conflict, missing approval, missing owner, manifest drift, or failed validation>`
