# IT & Communication Asset Management — Backend Requirements

Document date: 2026-10-27
Status: Proposed requirements for approval

## 1. Authority and Baseline

Read:

- `../requirement.md`
- `DESIGN.md`
- `../client/DESIGN.md`
- `../AGENTS.md`

The supplied backend design describes the template baseline.
These requirements do not independently verify its source.

The template's authentication, users, sites/stores, UOMs, HTTP
infrastructure, and reliability components are reuse candidates.

Asset, licensing, communication, procurement, custody, audit,
document, and maintenance domains are target work unless verified
in the actual source.

Do not claim an endpoint exists until it is registered and tested.

## 2. Architecture

### BE-ARCH-01

Preserve NestJS, Prisma, PostgreSQL, npm, and the modular monolith.

### BE-ARCH-02

Controllers handle transport; services own authorization, domain rules,
transactions, and response projection.

Use runtime DTO classes. Do not expose raw Prisma entities.

### BE-ARCH-03

Preserve existing `modules/master` conventions.

Add focused domain modules with approved ownership. Proposed owners:

| Domain | Owned records |
|---|---|
| Master | Categories, manufacturers, models, vendors, employees |
| Assets | Asset register, components, relationships |
| Custody | Reservations, assignments, returns, movements |
| Procurement | Requests, purchase references, receipts |
| Software | Products, installations, normalization |
| Licensing | Entitlements, allocations, assessments, renewals |
| Communication | SIMs, numbers, plans, circuits, service assignments |
| Maintenance | Plans, tickets, work logs, downtime |
| Verification | Campaigns, observations, discrepancies |
| Retirement | Retirement and disposal |
| Documents/imports | Metadata, upload/import lifecycle |
| Reporting | Scoped read projections |
| Integrations | Connectors, observations, reconciliation |

Platform modules must not own domain-specific approval or licensing rules.

### BE-ARCH-04

Use narrow exported directory/policy services for cross-module access.
Do not introduce a universal repository or configurable CRUD framework.

## 3. Data Model Requirements

### 3.1 Common fields

Organization-owned records require, as applicable:

- UUID ID.
- Organization ID.
- Creation/update timestamps.
- Creator/updater identity.
- Version for editable aggregates.
- Explicit lifecycle fields.
- Approved business identifiers.
- Historical references.

Never accept organization identity as authority from request bodies.

### 3.2 Required entity groups

| Group | Proposed entities |
|---|---|
| Organization | Existing Organization, Location, Store; Department, CostCenter |
| People | Employee, optional link to User |
| Masters | AssetCategory, Manufacturer, AssetModel, Vendor |
| Hardware | Asset, AssetRelationship, ComponentInstallation |
| Inventory | StockItem, StockMovement, StockReservation |
| Procurement | AssetRequest, RequestLine, PurchaseRecord, PurchaseLine, Receipt, ReceiptLine |
| Custody | Reservation, Assignment, AssignmentItem, Return, Movement, MovementLine |
| Software | SoftwareProduct, SoftwareEdition, Installation, SoftwareMapping |
| Licensing | Entitlement, EntitlementRight, Allocation, Assessment, Renewal |
| Communication | ProviderAccount, ServicePlan, CommunicationService, ServiceAssignment |
| Maintenance | MaintenancePlan, Ticket, WorkLog, PartUsage, DowntimeInterval |
| Coverage | Contract, AssetCoverage, WarrantyClaim |
| Verification | Campaign, ExpectedAsset, Observation, Discrepancy |
| Retirement | RetirementRequest, Disposal, SanitizationEvidence |
| Workflow | ApprovalRequest, ApprovalStep, ApprovalDecision |
| Platform | BusinessAuditEvent, Attachment, ImportJob, ImportRowError |
| Integration | Connector, SyncRun, SourceObservation, ReconciliationCase |

Finalize cardinalities and ownership before migrations.
Reuse existing entities only when their semantics match.

### 3.3 Required relational controls

- Organization-scoped asset-tag uniqueness.
- Same-organization references.
- One open custody assignment per asset.
- Valid user/device target for each license allocation.
- Multiple coverage contracts per asset.
- Multiple assets per contract.
- Receipt lines linked to their source purchase lines.
- No circular asset/location relationships.
- No overlapping active service assignments where the approved
  service type permits only one assignee.
- No negative quantities or invalid dates.
- Historical component installation/removal records.

Use database constraints where practical, plus transaction-level
validation for invariants that require multiple records.

### 3.4 Decimal and date rules

- Persist money and business quantities as approved Decimal types.
- Return exact decimals as strings.
- Do not use JavaScript floating point for authoritative totals.
- Define precision, scale, rounding, and overflow per field.
- Distinguish instants from calendar dates.
- Use explicit UTC API representations for instants.
- Do not alter legacy timestamp types without a reviewed migration.

## 4. State Ownership

### BE-STATE-01

Define which records are authoritative for:

- Custody.
- Location.
- Availability.
- Stock balance.
- License allocation.
- Discovery observations.
- External communication-service status.

Duplicated summary fields must be updated transactionally or treated
as clearly identified projections.

### BE-STATE-02

Represent formal transitions with command methods.
Do not allow unrestricted `PATCH { status }`.

### BE-STATE-03

Validate the transition, actor eligibility, current version,
required evidence, and related invariants in the command transaction.

## 5. API Contract

### 5.1 Shared conventions

- Prefix: `/api/v1`.
- Direct response bodies; no new universal success envelope.
- Lists: `{ items, page, pageSize, total }`.
- One-based pagination.
- Default page size 20; maximum 100 unless explicitly approved.
- Explicit supported filters and deterministic ordering.
- Existing problem-details response shape.
- Explicit create/update/read DTOs.
- Document whether each PATCH is partial or complete-edit.
- Exact decimals as strings.
- ISO instant strings and documented date-only strings.

### 5.2 Proposed endpoint groups

These are TARGET routes, not implemented endpoints.

| Area | Proposed routes |
|---|---|
| Masters | `/master/asset-categories`, `/manufacturers`, `/asset-models`, `/vendors`, `/employees`, `/departments` |
| Assets | `/assets`, `/assets/:id`, `/assets/:id/timeline`, `/assets/:id/relationships` |
| Reservations | `/reservations`, `/reservations/:id/cancel` |
| Custody | `/assignments`, `/assignments/:id/acknowledge`, `/assignments/:id/return` |
| Transfers | `/movements`, `/movements/:id/submit`, `/approve`, `/dispatch`, `/receive` |
| Requests | `/asset-requests`, `/asset-requests/:id/submit`, `/approve`, `/reject` |
| Purchasing | `/purchase-records`, `/receipts`, `/receipts/:id/post` |
| Software | `/software/products`, `/software/installations`, `/software/mappings` |
| Licensing | `/licenses/entitlements`, `/licenses/allocations`, `/licenses/assessments`, `/licenses/renewals` |
| Communication | `/communication/services`, `/communication/plans`, `/communication/assignments` |
| Maintenance | `/maintenance/plans`, `/maintenance/tickets`, ticket transition commands |
| Contracts | `/contracts`, `/warranty-claims` |
| Verification | `/verification/campaigns`, campaign observations and reconciliation commands |
| Retirement | `/retirements`, `/disposals`, approval/completion commands |
| Documents | `/attachments`, authorized upload/download lifecycle |
| Imports | `/imports`, `/imports/:id/preview`, `/imports/:id/commit`, `/imports/:id/errors` |
| Discovery | `/discovery/sync-runs`, `/discovery/observations`, `/discovery/reconciliation-cases` |
| Reporting | `/reports/...` |
| Notifications | `/notifications`, `/notifications/:id/read` |

Expand shorthand paths into exact contracts during feature approval.
Do not add all routes before their domain rules exist.

### 5.3 Concurrency

Use `If-Match` for new versioned aggregate commands unless an approved
existing contract uses body versions.

Bulk commands must provide per-item versions or an approved aggregate
version strategy.

Conflicts return 409 and must not trigger unconditional updates.

### 5.4 Lookup APIs

Provide paged/searchable selectors.
A first page of results must not masquerade as a complete lookup list.

### 5.5 Exports

Apply organization, entity scope, and field permissions.
Large exports use approved asynchronous processing with authorized
status and download endpoints.

## 6. Authorization

### BE-AUTH-01

Use existing JWT and permission guards plus service-level entity scope.

### BE-AUTH-02

Check organization and reference scope for:

- Detail and list reads.
- Counts and dashboards.
- Commands.
- Nested lookups.
- Uploads and downloads.
- Exports and reports.
- Import rows.
- Worker processing.

### BE-AUTH-03

Revalidate mutable eligibility inside transactions when necessary.

### BE-AUTH-04

Resolve the documented tenant-login ambiguity before multi-organization
deployment.

### BE-AUTH-05

Resolve authentication configuration, cookie deployment, refresh
rotation/reuse handling, and logout semantics through an explicitly
approved hardening task.

Do not replace authentication incidentally while adding ITAM modules.

## 7. Transactions and Reliability

### BE-REL-01

Before retry-sensitive posting, resolve the template's idempotency gaps.

Command identity must bind:

- Organization.
- Actor or approved integration principal.
- Operation.
- Resource.
- Canonical payload.
- File checksum where applicable.

### BE-REL-02

Business changes, successful command outcome, audit records, and outbox
events must participate in the approved atomic transaction design.

### BE-REL-03

A replay must not bypass current authorization or expose a response
across organizations or actors.

### BE-REL-04

Use database-backed protection for concurrent:

- Assignment.
- Reservation.
- Stock issue.
- Receipt posting.
- License allocation.
- Transfer receiving.
- Disposal completion.

Application prechecks alone are insufficient.

### BE-REL-05

External provider calls must not execute while holding a database
transaction.

### BE-REL-06

Document handling of commands whose outcome is unknown to the caller
after a network interruption.

## 8. Outbox and Workers

### BE-WRK-01

Register and test handlers before producing business topics.

Proposed event families include:

- Assignment acknowledgment requests.
- Renewal reminders.
- Repair notifications.
- Import processing.
- Discovery reconciliation.
- Approved report generation.
- External service-change requests.

### BE-WRK-02

Handlers must tolerate duplicate delivery.

### BE-WRK-03

Define lease duration/renewal, execution limits, retry classification,
dead-letter handling, and graceful shutdown.

### BE-WRK-04

Carry approved organization, actor, correlation, and event-version
metadata.

### BE-WRK-05

Never mark an unsupported topic or failed external operation successful.

## 9. Domain-Specific Correctness

### BE-DOM-01 Custody

Issue, acknowledgment, return, and exception resolution must preserve
the historical custody chain.

### BE-DOM-02 Movement

Receiving updates only the assets actually received.
Partial receipt must remain visible.

### BE-DOM-03 Licensing

Serialize competing allocations against entitlement capacity.
Separate subscription dates, metrics, allocations, and evidence.

Unsupported complex metrics return needs-review, not fabricated compliance.

### BE-DOM-04 Communication

Separate local requests from provider-confirmed service state.

### BE-DOM-05 Discovery

Authenticate ingestion sources.
Deduplicate source events.
Preserve source timestamps and provenance.
Prevent stale observations from overriding newer authoritative data.

### BE-DOM-06 Maintenance

Track ticket state separately from equipment availability.
Returning equipment to service requires the configured verification.

### BE-DOM-07 Disposal

Prevent disposal while required custody, approval, sanitization,
or recovery steps remain unresolved unless an approved exception exists.

## 10. Documents and Imports

### BE-FILE-01

Introduce an approved storage adapter with database metadata.
Do not generalize the legacy BOQ byte-storage pattern.

### BE-FILE-02

Enforce limits before fully buffering uploads.
Validate declared type and actual content.

### BE-FILE-03

Authorize both upload and download against the target resource.
Storage keys must not be treated as authorization.

### BE-IMP-01

Separate uploaded, validating, preview-ready, failed, committing,
and committed states.

### BE-IMP-02

Validate duplicates within the file and against current database state.

### BE-IMP-03

Recheck mutable references and uniqueness at commit time.

### BE-IMP-04

Retried commits must not create duplicate business records.

## 11. Audit

### BE-AUD-01

Business audit must record safe, explicit projections rather than
blind copies of request bodies or database objects.

### BE-AUD-02

Audit data must be append-only through ordinary application roles.
Define administrative access, retention, export, and tamper controls.

### BE-AUD-03

Do not call audit storage “immutable” without documenting and testing
the actual enforcement boundary.

## 12. Migrations and Deployment

- Use additive reviewed migrations.
- Preserve applied migration history and SQL-only constraints.
- Do not use `db push` as the production migration strategy.
- Do not seed unknown databases.
- Do not reset deployed permissions through incidental seed changes.
- Apply migrations once per deployment.
- Document backfills and rollback/forward-recovery strategies.
- Keep secrets out of source, logs, examples, and frontend variables.

## 13. Backend Verification

Required test categories:

- DTO validation and unknown-field rejection.
- Organization/entity scope and denied references.
- Decimal/date boundaries.
- Database uniqueness/check constraints.
- State transitions and invalid combinations.
- Transaction rollback.
- Concurrent assignment and allocation.
- Idempotent command replay and changed-payload conflicts.
- Duplicate/out-of-order integration events.
- Worker retries and missing handlers.
- File access and import commit behavior.
- Report/export authorization.
- Fresh migration application.
- API response contracts.

Use the existing Nest/Jest/Supertest/PostgreSQL test infrastructure.

Run only against verified safe environments.

Completion reports must state:
- Files changed.
- Migrations added.
- Contracts introduced or changed.
- Commands actually run.
- Test/build results.
- Approved deviations.
- Remaining gaps.