# Packaging

The repository root is the source tree. It owns the runtime core, source validators, tests, public documentation, community assets, and release metadata.

`runtime-manifest.json` is the only owner of the concrete runtime allowlist and source-to-destination overlay mappings. `scripts/runtime_manifest_contract.py` owns the published-target role policy that validates those mappings:

- Core runtime: `SKILL.md`, professional references, project templates, the project guardrail, version, and license.
- Codex adapter: injects `agents/openai.yaml` and `references/studio-codex.md`.
- Claude Code adapter: replaces the fixed `references/runtime-adapter.md` slot with host facts and adds the exact one-line `assets/project-claude/CLAUDE.md` entry. It never overlays the shared bootstrap/adoption constitutions or ships a second governance owner.
- Gemini CLI: currently uses the portable core without a platform metadata overlay.
- Trae: experimental only; no adapter bundle is published before official loading and fresh-session validation.

`plugins/sliver-session-continuity` is a separate Codex plugin source tree. It is not owned by `runtime-manifest.json`, is never copied into any Skill runtime bundle, and has no runtime dependency on project truth documents. Its lifecycle, trust, local `PLUGIN_DATA` state, and live compaction evidence remain separate from the portable Skill release. The root release gate runs its deterministic safety suite to prevent a broken plugin source tree from shipping in the same repository, but that check does not install, trust, or live-validate the plugin.

Build output belongs under ignored `dist/` and must be validated before installation. README, CHANGELOG, compatibility docs, CI, source tests, posters, QR codes, and other platform metadata are source/presentation surfaces and must not enter runtime bundles.

The output leaf must be exactly `sliver-vibe-coding`. `--force` may replace only an empty standard leaf or a verified prior Sliver bundle. Symlinks, broad directories, wrong leaves, and unrelated content are rejected before deletion. The builder stages in the same parent, atomically swaps the bundle, and restores the prior verified bundle if placement fails.

`scripts/validate_release_candidate.py` is the platform-neutral release owner. GitHub Actions is only one adapter. Its static package gate rebuilds every published target. A separate full live claim additionally requires Task Decision, foundation, UI, and Studio fresh-session results for the same clean source candidate; missing live results remain `UNVERIFIED`.
