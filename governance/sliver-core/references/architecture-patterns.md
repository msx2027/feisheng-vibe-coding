# Architecture Pattern Decision Criteria

This file is the method reference for architecture pattern axes used by `tech-stack.md`. It does not own a separate workflow and it does not provide a universal preferred architecture. Select the smallest combination supported by current architecture drivers.

## Use Rules

- Architecture names are not a menu for the user.
- Every selected pattern must cite a current driver, scope, framework fit, operational cost, rejected simpler route, and re-evaluation trigger.
- Every axis may be `not_applicable` with evidence. Do not instantiate patterns merely to fill a template.
- Start with the simplest route that meets current and confirmed evolution needs, but simplicity cannot excuse ignored security, consistency, platform, tenant, or recovery requirements.
- Prefer framework-native organization when it satisfies the drivers. Add a local pattern only where its benefit exceeds its extra layers and maintenance cost.

## Deployment Topology Axis

### Monolith

Use when one deployable unit, one team/owner, shared release cadence, and ordinary scaling/fault needs are acceptable.

Reject or reconsider when evidence requires independent deployment, isolation, scaling, compliance boundary, or runtime ownership that a single process cannot safely provide.

### Modular Monolith

Use when one deployment remains operationally simplest but business capability boundaries, dependency direction, test isolation, or confirmed evolution require enforced modules.

Required proof: named modules, public interfaces, forbidden dependencies, data ownership, and an executable or reviewable boundary check. Do not call folders “modules” without dependency control.

### Microservices

Use only when current evidence shows material need for several of: independent deployment cadence, independent scaling, fault isolation, separate team ownership, compliance/data isolation, incompatible runtime needs, or a stable distributed boundary.

Reject when the argument is only future scale, fashion, “enterprise-grade”, or possible team growth. Account for distributed transactions, network failure, versioned contracts, observability, release order, data ownership, local development, and operational staffing.

### Serverless

Use for event/request workloads whose execution duration, state model, latency, traffic shape, provider limits, observability, and cost fit the platform.

Reject or isolate when long-running processes, predictable low latency, local/native capability, portable runtime, complex transactions, or provider limits conflict with the workload.

### Hybrid Processes

Use when platform capabilities genuinely require separate web, desktop/local, worker, model, or provider processes. Define bridge contract, auth, health, startup, failure, update, and rollback ownership.

## Internal Dependency Axis

### Framework-Native MVC Or Layering

Default when framework controllers/routes, services/models, modules, validation, data access, and lifecycle already provide sufficient ownership and test seams.

Do not add generic repositories, use cases, ports, and adapters solely for symmetry.

### Clean Or Hexagonal Boundary

Use locally where core policy must remain independent of volatile infrastructure/frameworks, several adapters implement the same stable capability, or replacement/testing value is current and measurable.

Reject global adoption when it creates pass-through interfaces, duplicated DTOs, mapping layers, wrappers around stable framework APIs, or a parallel lifecycle with no proven benefit.

## Domain Modeling Axis

### Transaction Script / CRUD Service

Use for straightforward workflows with limited invariants and state transitions. Keep validation, authorization, and transactions explicit; simple does not mean putting all rules in controllers or UI.

### Domain Model / Local DDD

Use around rule-dense domains with meaningful invariants, lifecycle, vocabulary, state transitions, calculations, or cross-feature policy. Limit DDD to the domain that needs it.

### Full DDD / Bounded Contexts

Use only when complex domain boundaries, independent models, organizational ownership, or integration language conflicts are current and evidenced. Do not create aggregates, domain events, repositories, factories, and bounded contexts for ordinary CRUD.

## Read And Write Axis

### CRUD / Unified Model

Use when read and write models, scale, permissions, and consistency needs are similar.

### Local CQRS

Use for a bounded flow where read shape/performance/security differs materially from write invariants or where commands need a distinct lifecycle. Keep it local and prove the simpler route is insufficient.

Reject project-wide CQRS for possible scale or stylistic separation. Account for synchronization, duplication, eventual consistency, debugging, and operational cost.

## Communication Axis

### Direct Synchronous Calls

Use when immediate result, transaction clarity, simple failure handling, and local ownership matter more than decoupling.

### In-Process Events

Use for secondary reactions inside one deployable unit when the event clarifies ownership without hiding critical transactions or errors.

### External Messaging / Event-Driven

Use when current evidence requires reliable asynchronous work, buffering, fan-out, independent processing, temporal decoupling, or cross-process integration.

Reject Kafka/queues for ordinary notifications or “future decoupling”. Define delivery semantics, ordering, idempotency, retry, dead letters, schema versioning, observability, replay, and consistency.

## Client API Axis

### Shared API

Use when clients share behavior, security, performance, and data-shape needs.

### BFF

Use only when current clients have materially different aggregation, latency, protocol, release, authorization, or experience needs. Reject one BFF per client by habit; account for duplicated logic and maintenance.

## Extensibility Axis

### Built-In Modules

Use when the product team owns all capabilities and release cadence. This is the default over a plugin protocol.

### Plugin Architecture

Use when third parties or independent internal teams need supported extension without changing the core, and the extension contract, sandbox/security boundary, versioning, discovery, permissions, lifecycle, compatibility, and support model are current requirements.

Reject plugin infrastructure for hypothetical extensibility.

## Organization Axis

### Product Application

Default when one product and team own the capabilities. Keep shared code local until real reuse and ownership emerge.

### Shared Platform / Middle Platform

Use only when multiple current products have proven common capabilities, service-level expectations, governance, funding, and a platform owner. Reject “middle platform” as premature extraction or organizational prestige.

## Overdesign And Underdesign Checks

Reject overdesign when:

- a pattern has no current driver or measurable benefit;
- several patterns are stacked because they are individually popular;
- framework-native behavior is wrapped by pass-through layers;
- future scale is the only reason for distributed infrastructure;
- the project lacks the people, deployment, monitoring, and incident ownership the pattern requires.

Reject underdesign when:

- complex invariants live in UI/controllers or scattered conditionals;
- required transaction, consistency, tenant, security, privacy, recovery, or offline boundaries are unnamed;
- confirmed multi-process/platform capability is forced into an impossible web-only shape;
- the simplest route creates a known near-term rewrite cliff with no reversible seam;
- deployment and operations are assumed rather than designed for real users.

## Pattern Decision Output

For every applicable axis record:

| Axis | Selected pattern and scope | Driver/evidence | Framework fit | Added cost | Rejected route | Re-evaluation trigger |
| --- | --- | --- | --- | --- | --- | --- |

The result is one coherent architecture combination, not a collection of pattern badges.
