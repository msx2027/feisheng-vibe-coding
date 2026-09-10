# Risk Control Gates

This file is the single runtime owner of protected risk lanes, their activation boundaries, and their minimum controls. Risk is independent from task depth: it adds only the controls needed for the affected boundary and never raises `D0-D3`.

## Activation Rule

Activate a lane only when current evidence identifies both:

1. a credible failure event; and
2. a real path from the requested work or next action to the protected boundary.

Technical nouns, file names, user anxiety, code size, or generic “best practice” concerns are not activation evidence. When a lane is inactive, do not load its full ceremony.

## Stable Risk Lane IDs

| Stable ID | Protected boundary | Minimum control when active |
| --- | --- | --- |
| `identity_permission` | identity, role, ownership, visibility, allow/deny enforcement | owner-bound allow and deny cases, cross-user/role negative case, authoritative enforcement point |
| `privacy_secret_data` | personal, confidential, credential, token, production log/data or secret material | minimum necessary access, redaction/no echo, destination and retention boundary, leak-negative check |
| `money_entitlement` | money, paid value, plan, quota, subscription, refund, entitlement | authoritative amount/entitlement owner, lifecycle/state-effect cases, idempotency and tamper negative cases |
| `persistent_data_schema` | stored data, migration, schema, destructive status or audit history | schema/migration truth, backup or restore route, forward/backward data effect, invalid-state negative cases |
| `public_contract_compatibility` | public API, CLI, documented config, install command or consumer contract | affected consumer map, explicit migration/break decision, contract examples and compatibility evidence |
| `external_provider_effect` | third-party API, webhook, OAuth, messaging, cloud or platform state | official/current contract, sandbox or bounded live path, error/quota/idempotency and secret handling |
| `supply_chain_config` | dependency, build, package, plugin, workflow, environment or release configuration | source/version identity, integrity/provenance available from current ecosystem, secret-safe config, reproducible build/check |
| `license_legal_content` | license, attribution, user content rights, policy or regulated content | source/license/consent evidence, forbidden-use check, unresolved legal judgment surfaced to the user |
| `physical_safety_device` | real device control, hardware state or physical safety | exact device/environment, safe state, stop/recovery path, current hardware evidence |
| `resource_reliability` | unbounded cost, capacity, rate, concurrency, storage, availability or abuse | explicit bounds, failure/degraded behavior, observability signal, stop condition |

Production/public exposure and delete/overwrite are action effects owned by `references/effect-recovery-gates.md`; do not duplicate them as risk lanes. They may activate one or more lanes above based on what is exposed or destroyed.

## Compact Event Record

For an active lane, retain only:

```text
lane_id
failure_event
affected_owner_or_asset
credible_path
business_or_human_impact
likelihood_or_confidence
uncertainty
control_floor
```

Ordinary tasks do not fill all lanes. Unknown details block only the operation that could cross the unresolved protected boundary; safe read-only inspection, design, dry-run, redacted local work, and unrelated reversible work may continue.

## Safety Invariants

- Audit does not authorize remediation.
- Read-only access can activate privacy controls when the material itself is sensitive.
- Apply the protected-boundary release blocking rule owned by `testing-strategy.md`; this lane does not redefine its test-set shape or verdict.
- A high-risk lane never authorizes broader discovery, Studio, Git history, provider writes, production access, or destructive action.
- Emergency or incident mode does not weaken the minimum control.
- Never echo secrets, direct personal contact/payment identifiers, or unnecessary sensitive payloads into logs, widgets, reports, fixtures, or user-visible output.

## Evidence

Evidence must prove the affected boundary, not merely that code compiled. Prefer the narrowest real owner-bound negative/state test. Use reproducible live or provider/hardware evidence when the boundary cannot be represented honestly in a deterministic test. Mark unavailable evidence `unverified`; do not convert it into a completion claim.
