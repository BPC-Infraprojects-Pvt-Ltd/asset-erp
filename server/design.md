# IT & Communication Asset Management — Backend Design

Document date: 2026-10-27
Status: Template-based architecture contract and implementation target

## 1. Purpose and Authority

This document adapts the supplied Inventory ERP backend architecture
for IT & Communication Asset Management.

Read with:

- `../agents.md`
- `../requirement.md`
- `./requirement.md`
- `../client/design.md`
- `../client/requirement.md`

### Labels

- BASELINE: reported by the supplied template documentation.
- RULE: implementation constraint.
- TARGET: capability requiring implementation.
- GAP: unresolved limitation.
- DECISION REQUIRED: policy requiring approval.

This document does not independently verify source, dependency versions,
registered routes, migrations, or test results.

Use source and tests to establish actual behavior.
Use approved requirements to establish intended behavior.

## 2. Architecture

### 2.1 Stack [BASELINE / RULE]

Preserve:

| Concern | Choice |
|---|---|
| Runtime/framework | Node.js, NestJS, Express adapter |
| Language | TypeScript |
| Persistence | Prisma |
| Database | PostgreSQL |
| Configuration | Existing Nest configuration |
| Authentication | Existing JWT/bcrypt first-party flow |
| Validation | class-validator and class-transformer |
| HTTP controls | Existing Helmet/CORS/rate-limit integration |
| Logging | Existing structured logger |
| Testing | Jest, Nest testing, Supertest |
| Package manager | npm |

Verify exact runtime and package versions from the manifest and lockfile.

Replacing the framework, ORM, authentication system, package manager,
or deployment model requires explicit approval.

### 2.2 Runtime topology

The backend is a modular monolith:

- HTTP API process.
- Separate worker process.
- Shared PostgreSQL persistence.
- Shared reliability and logging infrastructure.

The supplied template reports a PostgreSQL outbox/worker mechanism,
but no registered business producers/handlers.

Object storage, mail, discovery connectors, and provider integrations
are targets, not assumed infrastructure.

Do not add Redis, a broker, or microservices merely because background
processing is required.

## 3. Baseline Readiness

The supplied template reports:

### Registered areas

- Authentication and identity.
- User lifecycle.
- Role-permission management.
- Sites/locations and stores.
- UOMs and conversions.
- Partial Works/BOQ functionality.
- Health and HTTP infrastructure.

### Infrastructure with gaps

- Idempotency.
- Outbox and worker.
- Authorization consistency.
- Session hardening.
- Imports and attachments.
- End-to-end observability.

### ITAM domains not established by that baseline

- Assets and components.
- Custody and movement.
- Procurement/receiving.
- Software/license management.
- Communication services.
- Maintenance.
- Business audit.
- General documents.
- Verification.
- Retirement/disposal.
- Reporting and notifications.

Do not infer implementation from schema enums, permissions, DTOs,
or frontend screens.

## 4. Module Ownership

Preserve existing `src/modules/master` conventions.
Do not perform an incidental whole-tree reorganization.

### 4.1 Proposed owners [TARGET]

| Module | Responsibility |
|---|---|
| Master | Categories, manufacturers, models, vendors, employees |
| Assets | Registry and physical relationships |
| Custody | Reservations, assignments, returns |
| Movements | Dispatch and receiving |
| Procurement | Requests, purchase references, receipts |
| Software | Catalog, installations, normalization |
| Licensing | Entitlements, allocations, assessments, renewals |
| Communication | Plans, services, circuits, assignments |
| Maintenance | Plans, tickets, work logs, downtime |
| Contracts | Warranty/support coverage and claims |
| Verification | Campaigns, observations, discrepancies |
| Retirement | Retirement and disposal |
| Documents/imports | File metadata and import processing |
| Integrations | Connector state and source observations |
| Reporting | Scoped read projections |
| Notifications | User notifications and approved delivery |

Exact directory names must be confirmed against source and approved
feature boundaries.

### 4.2 Layer responsibilities

| Layer | Owns | Must not do |
|---|---|---|
| Controller | Route, guards, DTO/header binding, transport | Direct business calculations or unrestricted DB access |
| DTO | Runtime input shape and validation | Database reads or eligibility decisions |
| Application service | Scope, rules, transaction, response projection | Trust client totals/status/organization |
| Directory/policy service | Narrow cross-module validation/read access | Generic access to all tables |
| Prisma infrastructure | Connection/lifecycle/database access | Pretend implicit tenant filtering exists |
| Platform | HTTP, context, reliability | Domain approval/licensing rules |
| Worker handler | Approved asynchronous work | Silently complete unsupported events |

Current template services use Prisma directly.
Do not add a universal repository layer just to implement CRUD.

## 5. Identity, Organization, and Scope

### 5.1 Session baseline

The supplied design describes:

- Password login with bcrypt.
- Access JWT returned to the client.
- Refresh JWT in an HttpOnly cookie.
- Hashed refresh-token persistence.
- `/auth/me` identity, roles, permissions, and scopes.
- Forced-password-change restrictions.

Keep the existing shape unless an approved migration changes it.

### 5.2 Authentication adoption gaps

Resolve before production:

- Global email lookup versus organization-scoped uniqueness.
- Validated configuration versus fallback secrets.
- Cookie security and deployment policy.
- Atomic refresh rotation and reuse-family handling.
- Logout cookie/session behavior.
- Runtime DTO validation for authentication input.
- Consistent assignment validity checks.

Do not claim completed multi-tenant SaaS support from organization IDs alone.

### 5.3 Authorization rules

For every operation:

1. Derive actor and organization from authenticated context.
2. Check action permission.
3. Check entity location/store scope.
4. Check referenced-record organization and scope.
5. Check workflow eligibility.
6. Recheck mutable conditions within the transaction when necessary.

Apply these rules to:

- Lists and counts.
- Details and updates.
- Nested lookups.
- Files and exports.
- Imports.
- Reports.
- Worker jobs.
- Integration endpoints.

Role names and token claims alone are insufficient.

Preserve existing one-active-role-assignment, self-access, and
last-active-admin protections unless explicitly changed.

### 5.4 Employee versus login identity

Model employees/custodians separately from login users where needed.

An employee can hold equipment without an application account.
An approved link connects the employee record to a login user.

Historical custody must survive account deactivation.

## 6. Persistence

### 6.1 General rules

Use:

- UUID identifiers.
- Organization-scoped business uniqueness.
- Explicit foreign keys and indexes.
- Existing database naming conventions.
- Version fields for editable aggregates.
- Historical transaction records.

Do not hard-delete referenced business history through generic CRUD.

### 6.2 Proposed aggregate model

| Aggregate | Related records |
|---|---|
| Asset | Specifications, relationships, installed components |
| Request | Request lines, fulfillment references |
| Purchase | Purchase lines, receipts |
| Assignment | Asset/accessory issue and return evidence |
| Movement | Per-asset lines and receiving results |
| Entitlement | Rights, allocations, assessment evidence |
| Communication service | Provider/plan, assignments, change requests |
| Maintenance ticket | Work logs, parts, downtime intervals |
| Contract | Coverage links and claims |
| Verification campaign | Expected snapshot, observations, discrepancies |
| Retirement/disposal | Approvals, sanitization, handover evidence |
| Import job | File identity, validation results, commit outcome |

Finalize cardinality and aggregate boundaries before migrations.

### 6.3 Required invariants

- Asset tag unique within organization.
- No more than one open custody assignment per asset.
- License allocation has exactly one valid target type.
- Same-organization references.
- Nonnegative quantities and approved monetary bounds.
- Valid date intervals.
- No circular physical relationships.
- Valid component install/remove history.
- No duplicate receipt posting.
- No over-issue or over-allocation under concurrent commands.
- No assignment of disposed equipment.

Use SQL constraints where appropriate.
Application prechecks improve messages but do not protect races alone.

### 6.4 Money and quantities

Use Prisma Decimal/PostgreSQL numeric for authoritative arithmetic.

Approve:

- Precision and scale.
- Rounding point and mode.
- Overflow.
- Negative values.
- Currency context.
- Tax behavior if included.

Return exact decimals as strings.
Do not sum mixed currencies without an approved conversion policy.

### 6.5 Dates

Distinguish:

- UTC instants.
- Calendar dates.
- Organization timezone rules.

The supplied schema is not uniformly timezone-aware.
Do not silently convert existing timestamps to `timestamptz`.

Any conversion requires an explicit reviewed migration.

## 7. Authoritative State

### 7.1 Hardware dimensions

Keep separate:

- Lifecycle.
- Availability.
- Condition.
- Verification status.

Approve legal combinations and transitions.

### 7.2 Custody and location

The custody/movement transaction chain is authoritative.

If current custodian/location is stored on the asset for reads,
update it in the same transaction as the controlling business event.

### 7.3 Quantity stock

For quantity-tracked accessories:

- Transactions establish stock changes.
- Balances are projections.
- Reservations reduce available quantity according to approved rules.
- Corrections use approved reversal/adjustment.

Do not copy construction inventory states without approval.

### 7.4 Licensing

Keep separate:

- Product/edition rights.
- Commercial term.
- License metric.
- Allocation.
- Consumption evidence.
- Assessment result.

Unsupported metrics require review, not fabricated calculations.

### 7.5 Communication services

Separate local workflow state from provider-confirmed service state.

A locally completed request must not imply successful carrier execution.

## 8. HTTP Contract

### 8.1 Preserve existing conventions

- Prefix `/api/v1`.
- Direct success bodies.
- No universal success wrapper.
- Paged lists: `items`, `page`, `pageSize`, `total`.
- One-based pages.
- Default 20 and maximum 100 for standard master lists unless approved.
- Runtime DTOs.
- Explicit response projections.
- Supported filters only.
- Deterministic ordering.

Document whether PATCH is partial or a complete edit.

### 8.2 Validation

Preserve the global validation pattern:

- Transformation.
- Whitelisting.
- Rejection of non-whitelisted fields.

Validate nested DTOs, identifiers, lengths, ranges, and enums.

Database and workflow validation belongs in the service/transaction.

### 8.3 Errors

Preserve problem details:

- `type`
- `title`
- `status`
- `detail`
- `instance`
- `correlationId`

Do not introduce `{ code, message, details }` as an incompatible envelope.

Stable domain error codes require coordinated client/server work.

### 8.4 Commands

Use explicit command routes for:

- Submit/approve/reject.
- Dispatch/receive.
- Assign/return.
- Allocate/revoke.
- Verify/reconcile.
- Retire/complete disposal.

Do not expose formal transitions through unrestricted status updates.

### 8.5 Proposed route families

Use the detailed endpoint requirements in `requirement.md`.

New route families are targets until registered and tested.
Existing `/master` conventions must be preserved where applicable.

## 9. Transactions, Versioning, and Idempotency

### 9.1 Transactions

Business mutations that must succeed together include:

- Aggregate updates.
- Dependent transaction records.
- Relevant audit records.
- Outbox records.
- Approved command outcome persistence.

Never call external providers while holding a database transaction.

### 9.2 Optimistic concurrency

Preserve conditional writes using:

- ID.
- Organization ID.
- Expected version.

Check affected-row counts.
Increment versions only for successful writes.

A failed version check must not fall through to an unconditional update.

Bulk commands need per-item versions or an approved aggregate contract.

### 9.3 Existing idempotency gap

The supplied template describes:

- Namespace/key uniqueness.
- Body-only fingerprinting.
- Missing resource/actor/organization binding.
- Separate business commit and response completion.

This is not an atomic business deduplication guarantee.

### 9.4 Required target

Before retry-sensitive workflow posting, approve and implement:

- Scoped command identity.
- Canonical payload fingerprint.
- File checksums when relevant.
- Atomic commit/replay behavior.
- Concurrent request handling.
- Authorized replay.
- Failure and expiry semantics.
- Recovery after process interruption.

Replays must not leak responses across organizations or actors.

Do not claim exactly-once external side effects.

## 10. Outbox and Worker

### Baseline

The supplied worker supports database polling, leases, retries,
and dead-letter state, but no production business handlers are established.

### Target rules

- Append events using the business transaction client.
- Register handlers before enabling producers.
- Include event version and approved organization/actor/correlation metadata.
- Make handlers safe under duplicate delivery.
- Define lease renewal or bounded execution.
- Define retryable versus terminal failures.
- Provide authorized dead-letter inspection/replay.
- Implement shutdown/drain behavior.
- Never mark unsupported events successful.

Potential topics include:

- Notifications.
- Import processing.
- Report generation.
- Discovery reconciliation.
- External service changes.

Approve infrastructure and operational requirements before activation.

## 11. Discovery and External Integrations

### 11.1 Ingestion

Authenticate connector principals independently of untrusted payload fields.

Record:

- Organization.
- Connector/source.
- Source resource identifier.
- Source event identifier where available.
- Observed timestamp.
- Received timestamp.
- Payload/schema version.
- Processing outcome.

### 11.2 Reconciliation

Use approved stable identifiers and matching policy.

Do not treat hostname, MAC, or serial as universally sufficient identity.

Ambiguous matches create review cases.

### 11.3 Field ownership

Define which source owns each field.

Discovery must not overwrite approved:

- Custody.
- Ownership.
- Financial values.
- Retirement/disposal.
- Verified location.

Preserve provenance and resolution history.

### 11.4 Ordering and duplication

Deduplicate repeated observations.
Prevent older observations from regressing newer state.

A missed observation is not confirmed deletion/uninstallation.

### 11.5 External actions

Track requested, processing, confirmed, failed, and uncertain outcomes.

Local success must not substitute for external confirmation.

## 12. Documents and Imports

### 12.1 Documents

Use an approved storage adapter with database metadata.

Store:

- Organization.
- Parent-resource association.
- Original safe filename.
- Content type.
- Size.
- Checksum.
- Storage reference.
- Upload/processing state.
- Uploader and timestamp.

Authorize upload and download against the parent resource.

Do not reuse synchronous BOQ byte storage as the general attachment design.

### 12.2 Upload safety

- Enforce limits before fully buffering.
- Validate content and type.
- Define scanning/quarantine behavior.
- Do not expose arbitrary storage keys.
- Do not log file contents.
- Define abandoned-upload cleanup and retention.

### 12.3 Imports

Use explicit states:

- Uploaded.
- Validating.
- Preview ready.
- Failed.
- Committing.
- Committed.

Approve all-or-nothing versus partial commit.
Revalidate mutable references at commit.
Use checksum-aware replay protection.

Business validation failures are distinct from transport errors.

## 13. Business Audit

Introduce a real business audit facility; application logs are insufficient.

Record:

- Organization.
- Actor or integration principal.
- Operation and resource.
- Timestamp.
- Correlation and command identity.
- Reason.
- Approved change projection.
- Related source records.

Avoid wholesale request/database snapshots containing secrets.

Ordinary application permissions must not update/delete audit events.

Define administrative access, retention, export, and tamper controls.
Do not describe the audit as immutable without verifying those controls.

## 14. Reporting

Reports are scoped read projections, not alternate sources of truth.

Requirements:

- Same organization/entity/field authorization as ordinary reads.
- Documented metric definitions.
- Explicit date basis and timezone.
- Currency-aware totals.
- Evidence freshness where relevant.
- Consistent filtering.
- No page-local aggregation presented as global totals.

Large exports require approved asynchronous processing, retention,
and authorized download behavior.

## 15. Configuration and Operations

### Configuration

Use validated configuration and existing environment conventions.

Do not:

- Add hardcoded production fallback secrets.
- Place backend secrets in browser variables.
- Treat Compose defaults as production configuration.
- Assume an unverified environment is disposable.

### Observability

Track:

- API failures.
- Correlation IDs.
- Worker lag and dead letters.
- Integration lag/errors.
- Import failures.
- Notification outcomes.
- Command conflicts and retries.

Do not assume exception formatting automatically logs all failures.

### Health

Preserve liveness and database readiness behavior.

Additional dependency checks must reflect deployment requirements
without unnecessarily making unrelated features unavailable.

### Deployment

- Build before starting compiled API/worker processes.
- Run API and worker separately.
- Apply migrations once per deployment.
- Use deployment-managed secrets and TLS.
- Review cookie/CORS/proxy behavior.
- Test backups and restoration.
- Define rollback/forward-recovery.
- Do not seed production as a routine startup step.

## 16. Migrations

- Add reviewed migrations.
- Preserve applied history and database-only constraints.
- Do not use `db push` as the production strategy.
- Define backfills explicitly.
- Review locks and rollout impact.
- Test on an isolated database.
- Do not incidentally rename legacy tables/columns.
- Do not change timestamp, role cardinality, or retention semantics
  without approval.

## 17. Verification

Required test areas:

- Runtime DTO validation.
- Permission and entity scope.
- Cross-organization references.
- Decimal/date boundaries.
- Database constraints.
- State transitions.
- Transaction rollback.
- Concurrent assignment/stock/license commands.
- Stale versions.
- Idempotency and authorized replay.
- Worker duplication and failure.
- Out-of-order discovery events.
- File access.
- Import commit safety.
- Scoped reports/exports.
- Fresh migration application.
- Client/server contract integration.

Verify scripts in the actual manifest before running them.

The supplied template includes commands such as:

- `npm test`
- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run build`
- `npm run lint:check`
- `npm run format:check`
- `npm run test:e2e`
- `npm run test:integration`

Some checks are scoped rather than full-tree.
Run targeted checks for changed files outside those selectors.

Confirm the configured database is safe before any integration command
that applies migrations or writes data.

## 18. Adoption Gates

| Gate | Required resolution |
|---|---|
| Tenant login | Unambiguous identity lookup |
| Authentication | Secure configuration/cookies/refresh/logout |
| Scope | Consistent permission and entity authorization |
| Reliability | Atomic scoped command deduplication |
| Async processing | Real handlers, leases, retries, replay |
| Documents | Approved storage and access model |
| Audit | Durable facility with tested controls |
| Domain workflows | Approved state/command tables |
| Financial behavior | Decimal/currency/rounding and ownership decisions |
| Discovery | Connector trust and field precedence |
| Production | Capacity, performance, backup, recovery, monitoring |
| Verification | Tests covering actual changed domains |

Record deviations with date, decision, reason, affected contracts/data,
migration/rollout plan, and verification.

These documents authorize work only within approved requirements.
They do not automatically approve unresolved business or architectural choices.