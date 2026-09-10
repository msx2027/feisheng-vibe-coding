# Runtime Adapter

This bundle declares no startup-time host adaptation. Continue with the portable runtime contract. Conditional host references keep their existing owners and load only when their route requires them.

## Runtime Root

`<sliver-runtime-root>` means the directory containing the selected Sliver
`SKILL.md`. Resolve it once from the host-provided Skill resource locator; never
infer it from the current project working directory or from a remembered install
path. For a filesystem-backed Skill, use the absolute parent directory of that
`SKILL.md`.

`<host-task-temp-root>` means the host-owned temporary directory whose identity
is stable for the current task/session and is writable without changing the
audited project. Resolve it from the host task context, never from project
conventions or from fields asserted by the model's decision. Pass the root and
stable task identity to the decision validator as external host context; the
decision may record them but cannot authenticate them. The root must be an
absolute, non-symlink directory. A temporary plan path is exactly
`<host-task-temp-root>/sliver-plan-<stable-task-id>.md`; reuse the same path
after compaction and handoff. If the host exposes no stable task identity or
task-scoped temporary root, stop before the write and request an explicit path;
never substitute a timestamp, random name, remembered path, or invented
`dev-docs/` convention.

`<host-task-durable-root>` exists only when the host explicitly documents a
task-owned store that remains addressable in later sessions. Its plan path is
`<host-task-durable-root>/sliver-plan-<stable-task-id>.md`. A normal OS temp
directory, session cache, or merely remembered path is not this root. If the
host provides no such retention guarantee, use an explicit path or established
internal truth for cross-session work.

Commands that execute a bundled script must replace `<sliver-runtime-root>`
with that resolved absolute directory and use `python3 -B`. Keep the target
project root as a separate argument. If the host exposes the Skill only as a
non-executable resource, do not copy the script into the project or fall back to
a same-named project path; report the script check as `未验证` and use only the
route evidence that the host can honestly collect.

## Enforcement Boundary

The runtime scripts are the only executable contract owners, but this portable adapter cannot prove that a Host invokes them before every write or release claim. Run Task Decision validation before `D2`/`D3` owner writes and whenever Host/Coordinator scope exclusions exist. Run the matching runtime-governance contract before non-mechanical UI work, formal materialization, or a release verdict. If the Host does not provide an actual pre-action Hook or wrapper that blocks on non-zero exit, report Host enforcement as `UNVERIFIED`; model compliance is not Hook evidence.

## Conditional Execution Liveness Adapter

Load `references/execution-liveness.md` only when an operation may yield a running receipt, an observable pending operation exists, or context degradation/handoff must close pending work. If `references/execution-liveness-host.md` exists in the selected runtime bundle, load it after the portable owner for Host-specific identity, refresh/cancel, yield, and optional-metadata mappings. Absence of that optional file does not weaken the portable contract and must not trigger path guessing or copying from another installation.

The Host fragment is an adapter, not a second lifecycle owner. It may narrow tool names and receipt fields but cannot change the portable transition table, final gate, privacy boundary, or Host/service limitation.
