# Runtime Adapter: Claude Code

This file overlays the fixed runtime-adapter slot for the `claude-code` bundle. Load it during Startup Protocol step 2. It owns host facts only; route selection, task depth, engineering gates, and validation requirements keep their existing owners.

## Runtime Root

`<sliver-runtime-root>` means the directory containing the selected Sliver
`SKILL.md`. Resolve it once from Claude Code's loaded Skill path; never infer it
from the current project working directory or from a remembered install path.
For this filesystem-backed bundle, use the absolute parent directory of that
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

`<host-task-durable-root>` exists only when Claude Code explicitly exposes a
task-owned store with a cross-session retention guarantee. Do not infer it from
auto memory, an OS temp directory, or a remembered path. Without that guarantee,
cross-session plans require an explicit path or established internal truth.

Commands that execute a bundled script must replace `<sliver-runtime-root>`
with that resolved absolute directory and use `python3 -B`. Keep the target
project root as a separate argument. If the loaded Skill path cannot be resolved
to an executable filesystem directory, do not copy scripts into the project or
fall back to a same-named project path; report the script check as `未验证`.

## Enforcement Boundary

Run Task Decision validation before `D2`/`D3` owner writes and when active exclusions are supplied by the coordinator. Run the matching runtime-governance contract before non-mechanical UI work, formal materialization, or a release verdict. Claude Code instructions alone do not prove a pre-action Hook; without a real wrapper or Hook that blocks on the validator exit code, Host enforcement remains `UNVERIFIED`.

## Project Constitution Entry

Claude Code reads `CLAUDE.md`, not the shared `AGENTS.md` constitution filename.

- Keep `AGENTS.md` as the single project-constitution owner.
- This bundle provides `assets/project-claude/CLAUDE.md` with exactly `@AGENTS.md`. When materializing a new or adopted project, first adapt the shared constitution template to that project, then place this thin entry beside the resulting root `AGENTS.md`.
- If an adopted project already has `CLAUDE.md`, inspect it and ask before replacing or merging it. Do not silently create a second constitution.
- `@` imports load the referenced content in full. The shared bootstrap and adoption templates remain below the host's 200-line guidance, so this adapter does not ship a second path-scoped governance layer.

## Auto Memory Boundary

Claude Code 2.1.59 and later enables auto memory by default. Its repository-local store lives outside the repository under `~/.claude/projects/<project>/memory/`; the first 200 lines or 25 KB of `MEMORY.md` load at session start, while topic files load on demand.

- Auto memory is machine-local convenience, not project truth, reviewable evidence, or proof for completion, safety, or release claims.
- Durable product, architecture, schema, security, release, and stage decisions still belong to the project truth owner selected by the portable runtime.
- When memory conflicts with project truth, ignore the stale memory for the current decision and report the conflict. Do not edit, delete, relocate, disable, or otherwise reconfigure memory without explicit user authorization.

## Host Facts

- Install root: `~/.claude/skills/sliver-vibe-coding`.
- `agents/openai.yaml` is not part of this bundle.
- Route names remain internal identifiers; route from natural-language intent rather than presenting them as slash commands.
- The session-continuity plugin source tree is not part of this bundle.

## Unverified

- Fresh-session discovery and loading behavior in the user's current Claude Code version.
- Host behavior before Claude Code 2.1.59.
