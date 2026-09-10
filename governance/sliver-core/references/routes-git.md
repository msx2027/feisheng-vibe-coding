# Git Route

Use this file with `git-and-delivery.md` when the user mentions Git, commits, remotes, private files, internal docs, or reference repositories.

## `git保护`

Goal: make the project reversible and prevent private material from entering commits or remotes.

Procedure:

1. Confirm the real project root and whether Git is already initialized.
2. If Git is missing and the root is confirmed, recommend initialization before major coding work; run `git init` only when the current request or a separate explicit confirmation authorizes that exact root.
3. Inventory private/internal material before staging: env files, secrets, internal docs, agent constitution, business plans, real cases, customer data, database dumps, uploads, generated artifacts, and third-party reference projects.
4. Create or update `.gitignore` before the first commit.
5. If internal truth docs need history but should not be pushed with code, use dual-repo management: root code repo ignores the internal truth root, and the internal truth root has its own local-only Git repo.
6. Classify agent constitution files as public-safe or private before committing.
7. If private files are already tracked, stop and report them; `.gitignore` alone does not fix tracked files.
8. If third-party reference repos or copied demos live under the project, ignore their exact paths unless the user explicitly approves vendoring after license and owner-boundary review.
9. If the user only asks to configure a remote URL, check existing remotes and configure the URL only; do not push without a separate explicit push confirmation.
10. For rollback, reset, checkout, restore, or `revert` requests, run the rollback audit and mixed-commit gate from `git-and-delivery.md` first and ask for approval before destructive commands.
11. Show files intended to track and files intentionally ignored before the first commit or remote push.

Output:

- Git root status.
- `.gitignore` decision list.
- Dual-repo decision if internal docs exist.
- Agent constitution privacy decision.
- Third-party reference repo decision.
- Remote configuration status and whether a push is explicitly approved.
- Rollback audit summary and loss estimate when rollback is requested.
- Mixed commit table with `keep / remove / unknown` decisions before any `git revert`.
- Tracked private-file risks.
- Files safe to stage.
- Files blocked from staging.
- User confirmations required.
