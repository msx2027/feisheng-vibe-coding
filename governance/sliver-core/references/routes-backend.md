# Backend Routes

This file owns only operation selection and handoff inside the `后端工程` route. It does not copy the backend boundary or backend architecture/skeleton contracts.

## Contents

- `boundary`
- `architecture`
- `skeleton`
- `acceptance`

## Operation Ownership

| Operation | Use when | Contract owner |
| --- | --- | --- |
| `boundary` | Backend responsibility, frontend/backend/data division, API need, auth/permission responsibility, or backend necessity is being created, audited, or is genuinely unclear. | `backend-boundary.md` |
| `architecture` | Backend foundation is being created or repaired, or current evidence proves a backend architecture conflict before skeleton/business code. | `backend-skeleton.md`, including its Backend Architecture Gate, Framework-first rules, and concrete backend-realization contract |
| `skeleton` | The accepted backend architecture needs a minimal runnable foundation or an existing skeleton needs repair. | `backend-skeleton.md` |
| `acceptance` | The backend architecture and skeleton need runtime-backed go/no-go validation before business development. | `backend-skeleton.md` |

Ordinary endpoints, local service changes, and bug fixes whose selected framework, owner, and validation path remain clear stay in `开发执行`; do not reopen this foundation route.

## Handoff Rules

1. Select exactly one operation from the requested result and current evidence.
2. For `boundary`, load and follow `backend-boundary.md`.
3. For `architecture`, `skeleton`, or `acceptance`, load and follow `backend-skeleton.md`; do not maintain a second field list or procedure here.
4. Every operation consumes the active framework-plus-architecture combination selected by `tech-stack.md`. Missing or contradicted foundation truth returns to `技术选型` with evidence instead of choosing another stack locally.
5. A blocking product fact is clarified in plain language, one question at a time only when it blocks the foundation decision. The user does not choose backend layers, framework, database, or architecture pattern.
6. Add `security.md` only when current identity, permission, data, input, secret, provider, public-exposure, or resource evidence requires it.

An operation handoff is invalid if it reselects the stack, duplicates the contract owner, invents generic layers before reading framework/project evidence, or promotes an ordinary local backend task into full foundation governance without a proven conflict.
