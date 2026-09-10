# Truth Capture Gate

This file is the single owner of how a conversation's product, boundary,
contract, design, or architecture conclusions become durable project truth. It
decides when to check, what to scan, which existing owner or new document
receives the conclusion, and how the write is authorized. It does not own the
executable plan (`plan-artifact.md`), stage control (`project-flow.md`), or
audit deliverables (`audit-artifact.md`).

Chat is not a truth owner. A conclusion that exists only in conversation is
lost at context compaction, in a new window, and to every other agent. The
default posture is: propose, show the user exactly what would be written where,
and wait for confirmation. Never silently create or rewrite a truth document.

## Trigger

Run this gate when at least one condition holds and the work is not `D0` or an
ordinary one-owner `D1` whose acceptance fits inline:

- the current conversation has produced at least two confirmed product,
  boundary, contract, design, or architecture decisions, or at least one
  decision that changes an existing truth document;
- the user confirms a proposal ("就这么定", "按这个做", "可以") and the next
  step moves from discussion into `D2`/`D3` implementation;
- context compaction has happened or is imminent, a new window is starting, or
  another agent will continue, and the conclusions are still only in chat;
- a Passive Signal below fires;
- a batch has just passed acceptance (Post-Acceptance Drift Check below).

Depth alone never creates a document requirement. A single bounded change with
one established owner keeps its acceptance inline and does not trigger this
gate.

## Passive Signals

Any of these means active truth is missing or stale; treat it as a trigger:

- the user is explaining project facts to the agent that no truth document
  records ("我们这个项目其实是……");
- the agent proposed a library, framework, provider, or pattern that the
  project no longer uses, which means the technical selection owner is stale;
- the user had to read source code to confirm something a truth document
  should answer;
- in a fresh session the agent re-asks questions the project already settled;
- nobody can say why a feature was designed the way it is. First record the
  current behavior honestly as a decision record with unknown rationale, then
  discuss changing it.

## Post-Acceptance Drift Check

After a `执行子阶段` or `验收` batch passes, before the next batch starts,
compare what was actually delivered against the project brief, function list,
technical selection, architecture, and current stage truth. Ask: does anything
the batch did differ from what the documents say?

- If differences exist, list them and present the Authorization Card with two
  options per item: update the document, or change the code back. The user
  decides; the agent does not pick one silently.
- Until the user answers, the next `执行子阶段` Task Decision records
  `truth_capture.decision: deferred` with the open items in `reason`. Do not
  start the next batch as if no drift existed.
- If no differences exist, record `truth_capture.decision: not_needed` and do
  not show a card.

This check is read-only and returns evidence; it is not the stage write-back
owned by `project-flow.md` and does not change the rule that a pure audit or
validation request never authorizes stage write-back.

## Read-Only Truth Scan

Before proposing any write, read the truth index (`dev-docs/README.md` or the
repository's established index) and the owners named in the Truth-Document
Order of `project-flow.md` that the conclusions plausibly touch. Do not read
`features/`, `decisions/`, or `audits/` as whole directories; open only the
entries the index or the current owner closure names.

Classify every conclusion into exactly one decision:

- `update_existing`: an active owner already holds this concept; the conclusion
  changes or extends it.
- `create_new`: no active owner holds it and the Scale Gate below says it needs
  its own document.
- `merge_into`: the concept already has an owner, but it is split across
  several small documents or a document is about to grow past one concern;
  consolidate instead of adding a file.
- `supersede`: an existing decision record is being replaced; write a new
  record that supersedes the old one and never rewrite history.
- `not_needed`: one sentence in an existing owner covers it, or the
  conclusion is task-local and already lives in the plan or stage record.
- `deferred`: the user has not yet answered an Authorization Card or a
  Post-Acceptance Drift Check; nothing is written and the reason is recorded.

Record the source of each classification: which document and section was read
and why it does or does not own the concept.

## Scale Gate

Choose the smallest durable landing point:

- one sentence covers it -> write one line into the existing owner;
- the owner exists -> update the main document and append an entry to its
  change log section (who, when, what changed, which confirmation). Do not
  create a new file for every change;
- the concept is a feature with its own internal rules, state machine,
  branches, permissions, or money flow, is depended on by several other
  features, or crosses owners -> `dev-docs/features/<feature>.md` from
  `assets/project-feature/feature-truth.md`, indexed from the function list
  and `dev-docs/features/README.md`;
- the conclusion is a decision rather than a feature (A was chosen over B, the
  choice is costly to reverse, or it will be questioned later) ->
  `dev-docs/decisions/adr-<id>.md` from `assets/project-decision/adr.md`,
  indexed from `dev-docs/decisions/README.md`; changes are new records that
  supersede old ones.

Product, architecture, schema, permission, security, and release facts remain
in their canonical owners; a feature or decision document links to them and
does not copy their contracts.

## Consolidation

Documents may grow without bound; the set the agent must read per session may
not. Apply these rules when classifying:

- prefer `update_existing` and `merge_into` over `create_new`;
- several small documents sharing one owner concern are merged into one;
- one document covering several unrelated concerns is split, and the index
  updated in the same write;
- a feature or decision document that is no longer active is marked
  `status: superseded` or `status: archived` in its frontmatter and moved only
  through `整理开发资料` with user approval; archiving is never deletion;
- `features/`, `decisions/`, and `audits/` each keep a README index; a document
  that is not in its index is not discoverable and the guardrail reports it.

Budget thresholds and the compaction offer are owned by `project-intake.md`.

## Authorization Card

Every `update_existing`, `create_new`, `merge_into`, or `supersede` decision is
presented before any write. The card has exactly five lines:

1. confirmed decisions: `<N>` items, one short clause each;
2. update: `<existing path>` or `none`;
3. create: `<new path>` or `none`;
4. basis: which document and section were read for each classification;
5. cost of not writing: what will be reconstructed from chat after compaction
   or lost to the next session.

The user's confirmation of this card is the only authorization evidence for
the write. Repository preference, a prior stage, or the agent's own judgment
never substitutes for it. Creating a new feature or decision document is
action `truth_doc_write`, including the new ADR in a `supersede` decision.
Changing an existing owner is action `local_edit`. For supersession, the card
names the new ADR, old ADR metadata, and index; preserve the old decision body,
and target each metadata/index update separately using `update_existing`.
Both are `local_reversible` in `effect-recovery-gates.md`, and both still
require the confirmed card as `authorization_evidence`.

When the user declines, record `not_needed` with the user's reason and keep
the conclusion visible in the plan or stage record for the current task only.

## After Write

- Update the relevant index in the same write: the function list and
  `features/README.md` for a feature, `decisions/README.md` for a decision,
  the truth index for a new owner.
- Run `python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py
  <project-root> --mode <bootstrap|adoption|stage> ...` for the touched truth
  surface. Its vague-term scan reports words such as `待定`, `所有人`, `同时支持`
  as warnings with file and line; list them to the user and do not edit them
  automatically.
- From this point the conversation's version of the conclusion is not
  authoritative; later disagreement is resolved against the written owner.
- Record the outcome in Task Decision `truth_capture` with the exact target.

## Not This Owner

- The ordered executable plan, its write-through, and its closeout belong to
  `plan-artifact.md`.
- Stage control fields, readiness gates, and stage write-back belong to
  `project-flow.md`.
- Audit findings and audit reports belong to `audit-artifact.md`; unresolved
  findings are promoted into a live owner through that file, not through this
  gate.
- Doc-root repair, inventory, archiving, and compaction belong to
  `project-intake.md`.
