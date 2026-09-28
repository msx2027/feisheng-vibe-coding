# Database Design

Use `数据库设计` before creating tables, changing schema, or implementing database-heavy features.

For front-end/back-end/database products, prefer designing the database after the main user flow, page flow, or function list is clear. Do not start by creating tables from a vague idea.

## Sequence

1. Derive business objects from product flows, page flows, or function list.
2. Confirm relationships between objects.
3. Choose the main database service.
4. Design tables and fields.
5. Check normalization and intentional denormalization.
6. Generate schema or migration files first.
7. Review the schema/migration against business flows before executing it.
8. Validate by running migration and sample reads/writes.

Treat these as separate actions with separate effect decisions: generating an
exact-path migration file is `local_reversible`; executing it against any
persistent database is `controlled` action `migration`; sample writes to a
persistent/shared database are a separate controlled action
`persistent_sample_write`; staging or
committing the reviewed files is a later `git_history` action. Authorization for
one step never authorizes the next, and a local generated file does not prove a
database migration or sample write occurred.
9. Commit a Git checkpoint after validation.

## Business Objects

Ask what the project contains:

- Users.
- Orders.
- Products.
- Content items.
- Comments.
- Files.
- Tasks.
- Roles.
- Permissions.
- Payments.
- Appointments.
- Logs.

Each object must map to a business scene. Do not invent tables just because they sound common.

If the business scene is unclear, route back to `立项`, `拆分`, or frontend flow clarification before designing fields.

## Relationships

For each relationship, explain:

- One-to-one, one-to-many, or many-to-many.
- Which table carries the foreign key.
- Whether an association table is needed.
- Why the relationship matches the business.

## Database Choice

For common business systems, admin systems, SaaS tools, content platforms, orders, payments, and permissions, prefer a relational database such as PostgreSQL or MySQL unless constraints say otherwise.

SQLite can fit local tools or lightweight desktop/local apps.

Redis is usually not the main database. Treat it as cache, sessions, verification codes, rate limits, queues, or temporary data only when there is a real need.

## Field Rules

Use clear English snake_case names unless the stack convention differs.

Common rules:

- `id` for primary key.
- `created_at` and `updated_at` for timestamps.
- `deleted_at` for soft delete when records should not disappear permanently.
- Passwords use password hash fields, not plaintext.
- Money uses integer minor units or exact numeric types, not floating point by default.
- Status fields must have named allowed states.
- Important nullable fields need business reasons.
- Ownership fields, role fields, deletion behavior, and audit fields need explicit business meaning.
- Time fields must state timezone or framework convention when it matters.

## Normalization

Use the first three normal forms as a basic check:

- One field stores one meaning.
- Fields belong to the table's main object.
- Fields should not depend on other non-key fields.

Denormalization is allowed only with a written reason, such as history snapshots or performance, and must include consistency responsibility.

## Schema Truth

Database structure must live in schema or migration files. Do not make direct database changes without updating schema/migrations.

Do not execute database changes before the schema/migration file exists and has been checked against the truth documents. If direct database inspection is used for validation, clearly separate it from the official migration path.

Any database structure change must explain:

- What changed.
- Why it changed.
- Which features are affected.
- Migration path.
- Rollback or recovery consideration when needed.

## Validation

Evidence should include:

- Migration command and result.
- Tables created or changed.
- Sample insert.
- Sample query.
- Connection config source.
- Unverified items.
