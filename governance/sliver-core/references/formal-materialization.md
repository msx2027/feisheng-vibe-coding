# Formal Materialization Contract

Apply this gate immediately before a formal artifact event: render, export, package, archive, signed build, deployment candidate,
or another formal
deliverable. Discovery, source edits, disposable drafts, and probes remain
outside this gate unless they create the artifact that will be handed off.

The record uses `sliver-formal-materialization/v1`. The Host or Coordinator,
not the candidate record, supplies the expected artifact identity, the source revision and accepted-input digest,
the coordinator-authenticated complete review set, and the active writer identities. A model-authored record cannot
authenticate those values itself.

Materialization is allowed only when:

- every expected blocking review is present exactly once and is `completed`;
- every review is bound to the current source revision and accepted-input
  digest;
- the artifact record matches that external identity and input context;
- exactly one writer holds the single writer lease for the artifact.

An `interrupted` or `failed` review, a missing or extra review, a stale review,
no writer lease, or a writer collision must fail closed. Any source or accepted
input change makes the earlier review and artifact stale; rebuild and
revalidate instead of continuing from the old output. Never use a partial review as completion evidence.

Plans keep their existing Task Decision owner. Before a blocking-review plan
write, the plan flow consumes this same formal gate with
`artifact_kind: formal_deliverable`; it does not define a second review-set or
writer-completeness rule. `plan_review` records decision phase and refs, while
this contract validates the actual write event against Coordinator context.

Validate a record and the separately supplied context with:

```bash
python3 -B scripts/runtime_governance_contract.py --kind formal --record <record.json> --context <host-context.json>
```

This repository delivers the executable contract and wrapper interface. Unless
the Host invokes it before the actual materialization operation, Host-level
enforcement remains `UNVERIFIED`; Skill prose or candidate self-reporting is
not Hook evidence.
