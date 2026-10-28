# IT & Communication Asset Management — Agent Working Boundaries

Document date: 2026-10-27

## 1. Read Before Working

Read the relevant documents before planning or changing code:

- Product requirements: `./requirement.md`
- Frontend requirements: `./client/requirement.md`
- Backend requirements: `./server/requirement.md`
- Frontend architecture: `./client/design.md`
- Backend architecture: `./server/design.md`

For API, authentication, authorization, workflow, persistence, or
cross-application changes, read both design documents.

The supplied frontend template named `DESIGN - Copy.md` is the basis
of `client/design.md`, not a separate architecture.

### Document labels

- BASELINE: behavior reported in the supplied template documentation.
- RULE: mandatory implementation boundary.
- TARGET: intended capability that requires implementation and verification.
- GAP: unresolved limitation.
- DECISION REQUIRED: policy or architecture requiring approval.

The supplied source-review documents are not a fresh inspection of
this application's repository. Verify actual source, migrations,
registered routes, consumers, and tests before making implementation claims.

## 2. Product Boundary

This application manages:

- IT hardware and communication equipment.
- Individually tracked accessories and components.
- Quantity-tracked IT accessories and spare parts.
- Software products, installations, entitlements, and allocations.
- Subscriptions and renewals.
- SIMs, telephone services, communication plans, and circuits.
- Requests, receiving, custody, transfers, repairs, and verification.
- Retirement, disposal, supporting documents, and audit history.

Do not import construction-specific BOQ, shuttering, approval windows,
or inventory semantics from the source template.

Do not introduce general fixed-asset accounting, native endpoint control,
full warehouse ERP, payroll, or HR administration without approval.

The application has full product scope. Delivery sequencing does not
silently remove requirements or redefine the application as an MVP.

## 3. Requirement and Decision Authority

Use this order:

1. Explicitly approved task and acceptance criteria.
2. Approved product requirements and recorded decisions.
3. Frontend/backend design rules.
4. Source, migrations, and tests as evidence of actual implementation.

If these disagree:

- Identify the conflict.
- Explain the affected behavior and data.
- Obtain a decision before changing business semantics.
- Do not silently convert a prototype, bug, or old target into a rule.

Proposed roles, states, endpoints, and approval policies are not approved
merely because they appear in a document.

## 4. Preserve the Architecture

### Frontend

Keep:

- React and TypeScript.
- TanStack Router, Query, and Table.
- Zustand for approved session/transient state.
- React Hook Form and Zod.
- Shared Tailwind/Radix/shadcn-style UI.
- Shared Axios API boundary.
- pnpm and its lockfile.

### Backend

Keep:

- NestJS and TypeScript.
- Prisma and PostgreSQL.
- Modular monolith.
- Separate API and worker entry points.
- Existing first-party authentication shape.
- npm and its lockfile.

Do not replace frameworks, ORM, package managers, authentication,
state management, UI primitives, deployment topology, or infrastructure
as an incidental part of a feature.

Do not introduce generic repositories, a universal CRUD engine,
CQRS/event sourcing, microservices, or a broker without approval.

## 5. Trace Before Editing

For a feature, trace:

1. Requirement and approved workflow.
2. Route and navigation.
3. Feature page, forms, and query hooks.
4. Typed client API.
5. Registered controller and guards.
6. Application service and entity scope.
7. Prisma models and SQL migrations.
8. Audit/outbox handling.
9. Relevant tests.

Use the API-backed UOM feature as the template integration reference
where its actual source is available.

Prototype stores are visual references only.
A DTO, enum, seeded permission, or screen is not proof of an endpoint.

## 6. Ownership Boundaries

- Controllers own transport, not business calculations.
- Services own domain rules, scope, transactions, and response projection.
- DTOs validate input shape, not database state.
- Narrow exported services provide cross-module access.
- The server owns workflow eligibility and authoritative calculations.
- TanStack Query owns server state.
- React Hook Form owns form drafts.
- Local UI state owns presentation only.
- Business audit is distinct from application logging.

Do not write another module's records through an unrestricted helper.
Coordinate multi-module operations through intentional application services.

## 7. Data and Workflow Invariants

Preserve:

- Explicit organization and entity scope.
- Organization-scoped business uniqueness.
- Same-organization references.
- One open custody assignment per individually tracked asset.
- Separate lifecycle, availability, condition, and verification state.
- Exact monetary and quantity arithmetic.
- Historical records and source references.
- Version checks and database constraints.
- Approved command transitions and correction workflows.

Do not:

- Trust client totals, roles, organization IDs, or status changes.
- Model approval/posting as arbitrary `PATCH { status }`.
- Overwrite posted history.
- Directly edit a projected stock balance.
- Treat a missing discovery observation as confirmed removal.
- Treat local deallocation as confirmed external account revocation.
- Treat surplus licenses as a compliance violation.
- Display compliance as known when evidence is missing or stale.

## 8. Reliability and Side Effects

Before retry-sensitive workflow implementation:

- Resolve the documented idempotency adoption gaps.
- Bind command identity to organization, actor, operation, resource,
  canonical payload, and file checksum when applicable.
- Protect concurrent business invariants in the database/transaction.
- Reuse the same key for the same logical retry.
- Do not call external providers while holding a database transaction.
- Commit business changes, audit, and outbox records atomically where required.
- Register and test worker handlers before producing their topics.
- Design external delivery for at-least-once processing and deduplication.

Do not claim exactly-once processing or immutable audit without verified
enforcement boundaries.

## 9. Security and Session Boundaries

- Derive organization and actor from authenticated server context.
- Apply scope to lists, counts, nested references, files, reports,
  imports, exports, and worker work.
- Preserve first-party auth unless a migration is approved.
- Keep access tokens out of localStorage/sessionStorage.
- Isolate sensitive caches during logout and identity/scope changes.
- Do not place secrets in `VITE_*` variables.
- Never log credentials, refresh tokens, license secrets, or file contents.
- Do not create demo administrator fallbacks.

Authentication and cache-isolation gaps must be addressed explicitly,
not hidden by persistence workarounds.

## 10. Ask Before Changing

Obtain approval before changing:

- Stack, dependencies, infrastructure, or deployment model.
- Authentication, tenancy, or login identity rules.
- API/error envelopes or shared versioning conventions.
- Role cardinality, permission semantics, or entity scope.
- Approval authority, thresholds, or self-approval.
- Currency, taxes, rounding, quantity, or accounting behavior.
- Retention, deletion, or audit policy.
- Broad UI/navigation conventions.
- Discovery field ownership.
- External service automation.
- Destructive migrations or production data operations.

An unresolved decision blocks the affected behavior, not unrelated work.

## 11. Safe Repository and Database Work

- Preserve unrelated work.
- Do not hand-edit generated route output.
- Do not rewrite applied migrations.
- Do not run destructive reset commands without explicit approval.
- Do not seed an unknown database.
- Do not replace existing environment files.
- Confirm a disposable database before integration/migration tests.
- Do not reset deployed permissions through incidental seed changes.
- Do not assume the containing workspace is a single package or repository.

## 12. Verification

For changed behavior, include relevant tests for:

- Success and validation failures.
- Permission and organization/entity scope.
- Invalid cross-organization references.
- State transitions.
- Decimal and date boundaries.
- Stale versions.
- Transaction rollback.
- Concurrent commands.
- Idempotency and retries.
- Duplicate/out-of-order integration events.
- Worker failure and replay.
- Frontend draft preservation and cache isolation.

Use the existing test infrastructure.
Do not add a different runner merely to avoid configured tooling.

Run relevant checks and required builds.
Do not claim a script checks files outside its configured scope.

Documentation-only changes do not require runtime suites.

## 13. Completion Report

Report:

1. Requirements implemented.
2. Files changed.
3. Contracts and migrations added or changed.
4. Commands actually run.
5. Results and known baseline failures.
6. Approval decisions or deviations.
7. Remaining gaps.

A live feature requires durable server behavior, not a local mutation,
success toast, mock response, or complete-looking screen.

## 14. Instruction Discovery

This document provides working guidance; it does not sandbox agents
or enforce deployment gates.

If the agent host only discovers `AGENTS.md`, use that filename and
update companion references.

When opening only `client` or `server`, ensure the agent also reads
the companion contract for cross-application work.

Enforce important boundaries through review, tests, permissions, and CI.