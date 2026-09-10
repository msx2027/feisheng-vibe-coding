# Truth Resolution Contract

Load this reference only when the requested answer depends on conflicting
sources, money or production state, a third-party's current behavior, or the
question "can this execute now?" Ordinary current-truth reads do not need this
record.

Truth authority is question-dependent authority, never a static file-type priority.
The rule is: open conflict requires `unverified`. Resolve only the
planes needed by the question:

- `product_contract`: the adopted product contract owns what the product must
  do; derived architecture and acceptance text cannot silently replace it.
- `implementation_state`: current implementation and runtime observation own
  what this checkout does now.
- `external_current_state`: fresh external evidence owns whether the provider,
  chain, production route, or other dependency is currently available.
- `historical_cause`: Git history or an archive may establish why the present
  state evolved; history does not override the other three planes.

For every used source, record its plane, authority, freshness, and whether it
supports, conflicts with, or only contextualizes the answer. An open conflict
requires `unverified`; a closed conflict names the evidence and an explicit
resolution reason. A resolved plane must cite authority that owns that plane.
An external verdict requires fresh external evidence even when an architecture
contract says the design is possible.

When the user asks about current executability, put the current executable answer first.
State `available`, `unavailable`, or `unverified` from
`external_current_state`, then explain product or architecture possibility.
Never lead with a theoretical capability when the current route is unavailable
or unverified; never present architecture possibility as the current verdict.

The executable schema owner is
`scripts/runtime_governance_contract.py` under
`sliver-truth-resolution/v1`. Validate a synthetic or task-local record with:

```bash
python3 -B scripts/runtime_governance_contract.py --kind truth --record <record.json>
```

The record is decision evidence, not permission to modify a source owner and
not proof that a live provider check occurred.
