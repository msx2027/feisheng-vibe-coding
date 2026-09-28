# Git And Delivery

Use `git保护` and delivery checks to keep AI changes reversible.

## Git Baseline

Before major AI work:

- Confirm whether Git is initialized.
- Confirm the real project root before running `git init`.
- Check current status.
- Identify unrelated user changes.
- Identify nested repos and third-party reference projects inside the tree.
- Check `.gitignore` before the first commit.
- Decide whether current state is stable enough to commit.
- Do not overwrite or revert user changes unless explicitly asked.

For non-technical users, explain Git as a project checkpoint system.

If Git is not initialized and the directory is a confirmed real project folder,
recommend initialization before major AI coding work. Run `git init` only when
the current user request already authorizes that exact project root or after a
separate explicit confirmation. Do not initialize inside the wrong parent
folder, a temporary download folder, a third-party reference repo, or a folder
that mixes unrelated material.

If the root is unclear, stop and ask the user to confirm the project root before initializing.

## Initial Git Setup Procedure

For projects without Git:

1. Confirm the project root and whether it contains only this project.
2. Inventory private/internal material before `git add`: secrets, env files, internal docs, agent constitution, business plans, real cases, customer data, database dumps, upload files, generated files, and third-party reference repos.
3. Create or update `.gitignore` before the first commit.
4. If internal truth docs need local history but should not be pushed with code, set up dual-repo management.
5. Run `git status --short --untracked-files=all` and show what will and will not be tracked.
6. Make the first commit only after the user confirms the ignore policy and baseline contents.

Do not run `git add .` before the ignore policy is checked.

## `.gitignore` Safety Gate

Before any commit or remote push, ensure `.gitignore` covers project-appropriate private and generated material.

Common ignore candidates:

- `.env`, `.env.*` with real values, except reviewed examples such as `.env.example`.
- Secret files, API keys, private keys, certificates, tokens, service-account JSON, signing keys, and payment/provider credentials.
- Local config with real machine paths, local database files, database dumps, backups, exports, and production snapshots.
- Upload folders or user-generated files from local testing.
- Build output, caches, dependencies, logs, coverage, and generated temporary artifacts.
- Internal truth docs such as `dev-docs/` when they are private.
- Private agent constitution files when they include internal strategy, owner maps, private commands, or non-public workflow rules.
- Chat exports, product research, competitor notes, customer notes, commercial plans, and real case analysis.
- Third-party reference projects, downloaded templates, cloned comparison repos, and copied example apps used only for study.

Do not blindly ignore source directories that are part of the actual product. If a directory might be either product code or reference material, classify it first and ask the user if needed.

If private material is already tracked, `.gitignore` is not enough. Stop and report:

- Which private files are tracked.
- Whether they should be removed from the index while kept locally.
- Whether the secret needs rotation.
- Whether history cleanup is needed before any remote push.

Do not remove tracked files from Git history or run destructive cleanup without explicit user approval.

## Dual-Repo Management For Internal Docs

Use this when internal development documents need version history but should not be pushed with the code repo.

Default structure:

- Project root: normal code Git repo.
- Internal truth root, usually `dev-docs/`: separate local-only Git repo.
- Project root `.gitignore`: includes the internal truth root path.
- Internal truth root remote: none by default.

Procedure:

1. Confirm the internal truth root path.
2. Add that path to the code repo `.gitignore` before staging.
3. Initialize Git inside the internal truth root only after confirming it contains internal development material.
4. Commit internal docs in the internal repo separately from code.
5. Do not add a remote to the internal docs repo unless the user explicitly approves a private destination.

If `dev-docs/` is public-safe documentation instead of internal truth, do not force dual-repo. Classify the folder first.

## Agent Constitution Privacy

Agent constitution files may be public-safe or private. Classify before committing:

- Public-safe: general contributor rules, no internal strategy, no real customer/project secrets, no private commands, no sensitive owner map.
- Private: contains internal planning, owner maps, validation commands tied to private systems, governance history, commercial strategy, real cases, or prompt/agent-operation details that should not be public.

Default for non-technical users: keep private constitutions out of public remotes. If the tool must read the constitution from the project root, keep it local, add it to `.gitignore`, or keep the canonical constitution in the internal docs repo and place only a public-safe minimal instruction file in the code repo after user approval.

If an agent constitution, host entry file, or similar instruction file is already tracked, audit its content before pushing. If it is private, stop and ask whether to untrack, split into public/private files, or move it to the internal docs repo.

## Third-Party Reference Repos

If the project directory contains cloned GitHub repos, downloaded templates, copied demo apps, or same-class reference projects used only for comparison:

- Do not stage them into the product repo.
- Add their exact paths to `.gitignore`.
- Keep evidence in truth docs as links, names, notes, or local paths, not copied source code.
- If a reference repo is intentionally vendored into the product, require an explicit decision, license review, and owner map entry before committing it.

## Stage Commit Rule

A validated checkpoint may be recommended for commit, but `git commit` runs
only when the current user request or a later explicit confirmation authorizes
the exact staged scope. Never infer commit authorization from a stage passing,
a workflow preference, or the existence of changed files.

Useful checkpoint examples:

- Project initialized.
- Frontend skeleton validated.
- Database migration validated.
- Backend skeleton validated.
- Feature sub-stage validated.
- Security check completed.

Do not commit just because files changed. Commit when the project has a useful checkpoint.

A commit is not a product release or public version. Explain it to non-technical users as a local checkpoint unless it is later pushed, tagged, deployed, or handed to other people.

## Commit Readiness

Before committing, report:

- Changed files.
- What changed.
- Validation run.
- Unverified items.
- Whether truth documents were updated.
- Whether secrets or internal docs are accidentally included.

Before committing, classify staged changes into logical commit groups:

- One feature sub-stage.
- One bug fix.
- One docs/config-only change.
- One generated-output update tied to its source change.
- One cleanup/refactor with no behavior change.

Do not mix unrelated pages, routes, APIs, stores, database changes, generated files, and feature work into one commit just because they changed in the same session. If staged files span multiple independent goals, the AI must split them by goal. If they cannot be separated safely, explain the rollback/release consequences and ask the user only which product or release outcome should remain in scope.

## Remote Privacy

Distinguish:

- Local Git repository.
- Remote repository on the project's chosen Git hosting platform.
- Public or shared deployment URL.

Configuring a remote is not the same as pushing. When the user provides a remote URL, first check existing remotes and repository status, then configure the remote only if needed. Do not push in the same step unless the user explicitly approves the push after seeing the privacy checklist.

Never ask the user to paste account passwords, SSH private keys, personal access tokens, provider tokens, or deployment credentials into chat or public docs. Use the platform's normal authentication flow, local credential manager, environment variables, or secret manager as appropriate.

Before pushing remote, check:

- Public or private.
- Which files will be pushed.
- Whether secrets exist.
- Whether `dev-docs`, commercial plans, internal strategy, real cases, and agent constitution should stay private.

The default for non-technical users is to keep internal planning docs private unless they explicitly decide to publish them.

Before pushing, output two lists and ask for confirmation:

- Files intended to push.
- Files that should not be pushed.

If the user wants version history for internal `dev-docs` but does not want those docs online, suggest a separate local-only Git repo for that folder instead of pushing it to the code remote.

## Rollback Audit Before Destructive Git

Rollback, reset, checkout, history rewrite, file deletion, and index cleanup can lose current work. When the user asks to "回滚", "重置", "恢复到旧版本", or suspects a feature has drifted:

1. Stop before running destructive commands.
2. Compare current implementation against the current-stage truth document or accepted requirement.
3. List recent commits and summarize what each likely changed.
4. Identify the historical commit or file state closest to the accepted truth.
5. Explain what would be lost by each rollback option.
6. Prefer the smallest restore path: restore one file, one module, or one feature area before whole-project rollback.
7. Ask for explicit approval before running any destructive operation.

If the current uncommitted work may be valuable, propose a safe checkpoint or patch export before rollback. Do not use destructive Git commands to hide uncertainty.

## Mixed Commit Revert Gate

Use this gate when the user says `revert`, wants to remove one feature, or points at one commit that may contain multiple unrelated changes.

First do revert intent classification:

- `undo whole commit`: every change in the commit is wrong and should be reversed.
- `remove one feature from a mixed commit`: only part of the commit should be removed.
- `restore one file or module`: the desired result is file-level recovery, not commit-level reversal.
- `recover previous stable state`: the project needs a broader drift audit before selecting a restore point.

Do not run `git revert <commit>` until the commit content is audited. Inspect the commit with file and stat evidence, then output a table:

| file or area | change summary | belongs to requested rollback? | keep / remove / unknown |
|--------------|----------------|--------------------------------|-------------------------|

If any changed file or hunk is unrelated or unknown, whole-commit revert is blocked. Explain in plain Chinese that reverting a commit reverses the commit's diff as a unit; it does not know which feature the user meant. Prefer a targeted plan:

- Manually remove the specific feature files, routes, API calls, imports, menu entries, stores, migrations, and tests.
- Restore only selected files or hunks after showing what will change.
- Create a new corrective commit that removes the unwanted feature while preserving unrelated pages or fixes.
- If the commit is unpublished and the user explicitly approves history editing, discuss split/reset options as a separate destructive operation.

For non-technical users, do not ask "do you want to revert commit X?" before explaining what the commit contains. Ask the safer question: "你要删除的是整个提交里的全部改动，还是只删除其中某个功能？"

## Public URL Safety

A private GitHub repository does not automatically mean the deployed app is private. A public preview URL, storage bucket, generated asset path, admin route, or API endpoint can still expose sensitive data.

Before sharing any public or semi-public URL:

- Confirm who should be able to open it.
- Check whether the platform defaults to public access.
- Check whether uploaded files, generated files, logs, previews, database browser pages, admin paths, API docs, and internal docs are exposed.
- Check whether search engines can index the app.
- Check whether demo data is fake or real.
- Check whether login, role, and ownership rules are enforced by the backend when needed.

If the app is only for the user, a team, or a client, recommend private access, invite-only access, password protection, VPN, platform auth, or another project-appropriate restriction before sharing.

## Files Usually Not Public By Default

- Real secrets.
- `.env` with real values.
- Commercial plans.
- Internal product strategy.
- Real customer or case analysis.
- Private agent constitution.
- Internal `dev-docs`.
- Chat exports, product research, competitor notes, and private implementation truth documents.

Example config files with placeholders can be public when reviewed.

## Delivery Evidence

For a completed stage, gather:

- Commands run.
- Test result.
- App URL or API examples.
- Database migration evidence if applicable.
- Screenshots for visible UI when applicable.
- Security negative cases when applicable.
- Git commit hash if committed.

If the stage is not fully verified, say that directly.

## Release Checkpoint

Before a project is released to real users, clients, or a public remote environment, gather:

- Build command and result.
- Deployment target and environment name.
- Production environment variables and secret owner.
- Database migration, backup, and rollback plan.
- Third-party production settings and quota/cost notes.
- Health check and post-release verification steps.
- Log/monitoring location and support owner.
- Known risks and `未验证` items.

Do not treat a Git commit as a release. A commit is a checkpoint; release means external users or systems may depend on the result.
