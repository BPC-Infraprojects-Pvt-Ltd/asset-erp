# IT & Communication Asset Management — Product Requirements

Document date: 2026-10-27
Status: Proposed requirements for approval
Scope: Complete application, not an MVP

## 1. Purpose

Build an organization-wide application for managing IT hardware,
communication equipment, software, license entitlements, subscriptions,
and related operational records throughout their lifecycle.

The application must provide durable, server-backed management of:

- What assets and entitlements exist.
- Where equipment is located.
- Who owns, holds, or uses equipment and licenses.
- What is available, reserved, assigned, under repair, or missing.
- Purchase, warranty, support, subscription, and renewal obligations.
- Asset movements, service history, verification, and disposal.
- Software deployment, entitlement consumption, and reconciliation.
- Historical evidence, approvals, and accountability.

This document defines target requirements. It does not certify that
the template already implements these capabilities.

## 2. Companion Documents

- `AGENTS.md`
- `server/DESIGN.md`
- `client/DESIGN.md`
- `server/requirement.md`
- `client/requirement.md`

The supplied `DESIGN - Copy.md` is the frontend design document and
must be saved or referenced as `client/DESIGN.md`.

Keep the existing frontend and backend architectural conventions.

Do not import construction-specific BOQ, shuttering, stock approval,
or procurement authority rules into this application without approval.

### 2.1 Requirement status

- REQUIRED: included in the proposed application scope.
- DECISION REQUIRED: business policy must be approved before implementation.
- CONDITIONAL: required only when the corresponding integration or
  optional product capability is approved.

A proposed policy is not an approved policy.

### 2.2 Implementation status

Track each feature separately as:

1. Specified.
2. Backend implemented.
3. Frontend integrated.
4. Acceptance tested.
5. Released.

A screen, schema, permission, or DTO alone does not establish completion.

## 3. Product Scope

### 3.1 Hardware

Support configurable categories including:

- Laptops, desktops, workstations, and thin clients.
- Servers and storage equipment.
- Routers, switches, access points, firewalls, and network appliances.
- Mobile phones, tablets, desk phones, and IP phones.
- Printers, scanners, and multifunction devices.
- Conferencing, audiovisual, and communication equipment.
- UPS units and IT-related power equipment.
- Monitors, docks, headsets, and other peripherals.
- Individually tracked accessories and equipment components.

### 3.2 Software and licenses

Support:

- Software products and editions.
- Discovered or manually recorded installations.
- License entitlements and allocation.
- Per-user and per-device licensing.
- Subscriptions and SaaS account assignments.
- Contract-specific licensing metrics.
- Renewal and termination obligations.
- Usage evidence where supported by an approved integration.

### 3.3 Communication resources

Support:

- SIM and eSIM subscriptions.
- Mobile and fixed telephone numbers.
- Carrier/service-provider accounts.
- Voice and data plans.
- Internet and WAN circuits.
- Assignment of communication services to users, devices, and locations.

### 3.4 Supporting resources

Support vendors, contracts, warranties, locations, departments,
cost centers, purchase records, attachments, and employee references.

Users who can sign in and employees who can hold assets must be
distinguishable. An employee must not require a login account merely
to receive equipment.

### 3.5 Outside the default scope

The following require separate approval:

- General land, buildings, fleet, and industrial asset management.
- Payroll, HR administration, and general accounting.
- Full warehouse or manufacturing ERP.
- Native remote wipe, patch deployment, USB blocking, or endpoint control.
- Full network topology management or IP address management.
- Telecom call-content or message-content collection.
- Password vault functionality.
- Native endpoint agents.
- Offline writes.
- Full depreciation and general-ledger posting.

Integration with approved systems may expose relevant information
without making this application the owner of those capabilities.

## 4. Architecture Constraints

- Frontend: existing React, TypeScript, TanStack, Zustand,
  React Hook Form, Zod, and shared UI conventions.
- Backend: existing NestJS and Prisma modular monolith.
- Database: PostgreSQL.
- Client package manager: pnpm.
- Server package manager: npm.
- Preserve the existing first-party authentication integration.
- Preserve the `/api/v1` API prefix and problem-details error contract.
- Do not introduce microservices, message brokers, new auth providers,
  new UI libraries, or replacement persistence frameworks without approval.
- Durable business data must reside on the server.
- Existing prototype stores must not become production persistence.

## 5. Organization and Access

### ORG-01 Organization isolation

Every business record and operation must belong to an organization.
The server must derive organization identity from authentication.

### ORG-02 Hierarchy

Support locations, child storage locations, departments, and cost centers.

DECISION REQUIRED:
Approve whether the existing Location/Store hierarchy is retained
unchanged or extended for IT rooms, racks, and remote custody.

### ORG-03 Scope

Permissions must distinguish:

- Action permission.
- Organization membership.
- Location/store access.
- Resource access.
- Workflow eligibility.

### ORG-04 Proposed role responsibilities

| Role | Responsibilities |
|---|---|
| Administrator | Configuration, users, permissions, integrations |
| Asset Manager | Registry, custody, movements, verification, retirement |
| Technician | Assigned repair and maintenance work |
| Software/License Manager | Products, entitlements, allocations, renewals |
| Procurement/Finance | Purchasing, contracts, approved cost visibility |
| Manager/Approver | Authorized approval decisions |
| Employee | Own equipment, requests, acknowledgments, issue reporting |
| Auditor | Scoped read-only access and approved evidence exports |

These are proposed responsibilities, not approval of a replacement
role model. Preserve the template's current role-assignment cardinality
until an approved change is defined.

Recorded implementation decision (2026-10-27): use these eight roles as the
initial role catalog, with one role per user. Administrators provision users;
the first organization and Administrator are created through a one-time
interactive bootstrap command. Preserve self-access and last-active-admin
protections. This approves role identities and account provisioning only;
the role-to-capability and restricted-field rules in
`authorization-matrix.md` are approved as the baseline. The location
hierarchy is approved as Organization → parent/child Locations → Stores
attached to a Location, without separate room, rack, or remote-custody
hierarchy types. A grant at a Location includes that Location, all descendant
Locations, and Stores attached anywhere in that subtree. The listed
workflow-specific authority decisions remain unresolved.

Recorded security-data decision (2026-10-27): retain user Location grant and
revocation history indefinitely for accountability. This decision applies only
to user Location scope assignments and does not establish retention for other
audit or business records.

### ORG-05 Restricted data

Costs, employee details, contract terms, license secrets, and sensitive
communication identifiers must have explicit visibility rules.

## 6. Master Data

### MD-01 Required masters

Provide organization-scoped management of:

- Asset categories and types.
- Manufacturers and models.
- Departments and cost centers.
- Locations and stores.
- Employees/custodians.
- Vendors and service providers.
- Software publishers and products.
- Maintenance and failure classifications.
- Approved lifecycle reason codes.

### MD-02 Lifecycle

Masters support create, view, update, and deactivate/reactivate.

Referenced records must not be deleted merely because they are inactive.
Historical references must remain readable.

### MD-03 Validation

Define normalization, uniqueness, required fields, and permitted values
for each master. Preserve meaningful leading zeros in identifiers.

## 7. Hardware Asset Register

### HW-01 Asset profile

Each individually tracked asset must support:

- Internal ID and organization-scoped asset tag.
- Category, manufacturer, model, and serial number.
- Technical specifications.
- Ownership type.
- Owning organization and using department.
- Cost center.
- Current confirmed location.
- Custodian or shared-pool allocation.
- Lifecycle, availability, and condition.
- Purchase and receiving references.
- Commissioning date.
- Warranty and support coverage.
- Criticality.
- Attachments and notes.
- Version and creation/update metadata.

### HW-02 Identification

- Asset tags must be unique within an organization.
- Serial numbers must support duplicate detection.
- Do not assume serial numbers are universally present or globally unique.
- QR/barcodes must reference an authorized lookup, not expose secrets.

### HW-03 Relationships

Support:

- Parent/child equipment relationships.
- Installed and removed components.
- Bundles such as laptop, charger, dock, and headset.
- Links to software installations and communication services.

Prevent circular asset relationships.

### HW-04 Operational functions

Support search, filtering, detail views, controlled bulk actions,
label printing, imports, and exports.

### HW-05 History

Display a chronological timeline of approved changes, assignments,
movements, repairs, verification results, and retirement/disposal events.

## 8. Accessories and Stock

### STK-01 Tracking modes

Distinguish:

- Individually tracked equipment.
- Quantity-tracked accessories and spare parts.

A category's tracking mode must be explicit.

### STK-02 Quantity movements

For quantity-tracked items, support receipt, issue, return, transfer,
reservation, and approved adjustment.

Balances must be derived from durable transactions, not edited directly.

### STK-03 Controls

- No negative available quantity by default.
- Reservations must not exceed available stock.
- Corrections require traceable adjustment or reversal.
- UOM and quantity precision must be approved per item type.

## 9. Requests, Procurement, and Receiving

### PRC-01 Requests

Employees and authorized staff can request equipment, software,
licenses, accessories, or communication services.

Capture purpose, quantity, required date, department, and justification.

### PRC-02 Fulfillment

Approved requests can be fulfilled from available stock or procurement.

Prevent duplicate fulfillment.

### PRC-03 Purchase records

Support:

- Vendor.
- Purchase order and invoice references.
- Purchase lines.
- Quantity, unit price, currency, and approved cost fields.
- Contract references.
- Supporting documents.

DECISION REQUIRED:
Approve whether purchase-order authoring is native or delegated to ERP.

### PRC-04 Receiving

Support partial receipt, inspection, rejection, serial capture,
asset creation, and receiving evidence.

Record quantities independently from the purchase document.

### PRC-05 Corrections

Posted receipts must not be silently edited.
Define approved reversal/return handling before posting is enabled.

## 10. Reservation, Assignment, and Return

### CUS-01 Reservations

Reserve equipment for a request or approved user.
Capture start, expiry, reason, and cancellation.

### CUS-02 Assignment

Assign individually tracked assets to an employee, team, or shared pool.

Capture:

- Issuer and recipient.
- Issue timestamp.
- Expected return date when relevant.
- Condition and accessories.
- Purpose.
- Acknowledgment status.

### CUS-03 Custody invariant

An asset must not have more than one open custody assignment.

Multiple authorized users do not imply multiple simultaneous custodians.

### CUS-04 Return

Record actual return date, receiving staff, condition, accessories,
missing items, and follow-up actions.

A return requiring inspection must not immediately make equipment
available for reassignment.

### CUS-05 Overdue

Overdue is derived from an open assignment and its due date.
It must not replace the underlying assignment lifecycle.

### CUS-06 Offboarding

Provide a checklist covering:

- Hardware recovery.
- Accessories.
- License deallocation.
- SaaS account-removal requests.
- SIM/number/service reassignment or termination.
- Approved unresolved exceptions.

A local license deallocation must not be represented as successful
external account revocation without confirmation.

## 11. Transfers and Movement

### MOV-01 Movement records

Capture source, destination, affected assets, reason, requester,
approvals, dispatch, and receipt.

### MOV-02 Physical confirmation

Update confirmed location/custody only according to the approved
handover or receiving event.

Track destination and transit status separately.

### MOV-03 Bulk and partial receipt

Support multi-asset transfers and per-asset receiving results.

### MOV-04 Exceptions

Support rejection, missing-in-transit investigation, and approved
reconciliation. Cancellation after dispatch requires an explicit
recovery workflow, not an unrestricted status edit.

## 12. Software Catalog and Installation Inventory

### SW-01 Catalog

Maintain publisher, product, edition, version information,
commercial classification, and approved/prohibited policy status.

### SW-02 Installations

Track product, device, detected version, source, first seen,
last seen, and observation status.

### SW-03 Normalization

Support mapping discovered software names to canonical products.

Preserve source values and mapping history.

### SW-04 Freshness

A missed scan must not automatically prove uninstallation.
Distinguish present, absent-confirmed, stale, and unknown observations.

## 13. Entitlements, Allocations, and Subscriptions

### LIC-01 Entitlements

Capture:

- Product and edition rights.
- Contract and purchase references.
- License metric and purchased units.
- Effective and expiry dates.
- Renewal and notice deadlines.
- Applicable restrictions.
- Cost and currency.
- Supporting evidence.

Do not store license secrets in ordinary notes or audit payloads.

### LIC-02 Allocation

Allocate eligible entitlements to users or devices.

Enforce target type, date validity, organization, and approved
over-allocation policy.

### LIC-03 Metric separation

Licensing metric and commercial term must be separate concepts.

Examples:

- Metric: user, device, concurrent user, processor/core.
- Term: perpetual, subscription, fixed-term.

### LIC-04 Calculations

For supported seat metrics, calculate purchased, allocated,
available, expired, and excess quantities.

Do not apply seat arithmetic to complex metrics without approved rules.

### LIC-05 Compliance evaluation

Keep separate:

- Entitlement validity.
- Allocation utilization.
- Consumption evidence.
- Evaluation result.
- Evidence freshness.

Results must support unknown and needs-review states.
Excess purchased capacity is not itself a licensing violation.

### LIC-06 Renewals

Provide renewal calendar, notice deadlines, owners, approval,
renewal history, and termination tracking.

### LIC-07 Usage

CONDITIONAL:
Display approved integration-derived usage to support reclamation.
Do not collect detailed employee activity by default.

## 14. Communication Resources

### TEL-01 SIM and service records

Support provider, account reference, ICCID where applicable,
telephone number, plan, activation date, billing cycle, and status.

### TEL-02 Assignments

Track service-to-user and service-to-device history independently
from hardware custody.

Support replacement SIMs and device changes without losing history.

### TEL-03 Circuits

Track circuit ID, provider, service type, bandwidth, installation
location, contract, support reference, and service dates.

### TEL-04 Financial visibility

Support recurring charges and imported usage/cost summaries where approved.

DECISION REQUIRED:
Approve collected usage fields, access, and retention.
Do not collect message content or call recordings.

### TEL-05 External service actions

Track requested, confirmed, and failed activation/suspension/termination.

A local status update must not imply the carrier completed an action.

## 15. Discovery and Reconciliation

### DSC-01 Connectors

Integrate approved endpoint, directory, MDM, SaaS, or network sources.

### DSC-02 Observations

Store source identity, source device ID, timestamps, normalized data,
and synchronization status.

### DSC-03 Matching

Prefer approved stable source identifiers.
Serial, hostname, MAC, and other attributes are matching evidence,
not unconditional identity guarantees.

### DSC-04 Exceptions

Provide queues for unmatched devices, duplicates, conflicting values,
and ambiguous matches.

### DSC-05 Field ownership

Define authoritative sources per field.

Discovery must not silently overwrite custody, financial ownership,
or approved lifecycle decisions.

### DSC-06 Replay

Duplicate or out-of-order observations must not duplicate assets
or regress newer authoritative information.

## 16. Maintenance and Repairs

### MNT-01 Tickets

Support incidents, repairs, inspections, and preventive tasks.

Capture asset, symptoms, priority, assignee, vendor, work performed,
dates, costs, and evidence.

### MNT-02 Repair flow

Support diagnosis, waiting for parts/vendor, repair completion,
verification, closure, and reopening.

### MNT-03 Downtime

Track downtime intervals separately from ticket duration.
Prevent double-counting overlapping intervals in reports.

### MNT-04 Planned work

Support recurring maintenance plans for critical IT/communication equipment.

### MNT-05 Parts

Track parts issued, returned, installed, and removed.

## 17. Warranty, Support, and Contracts

### CON-01 Coverage

Support multiple warranties/support contracts per asset and multiple
assets per contract.

### CON-02 Contract details

Capture vendor, term, coverage, exclusions, support contacts,
service commitments, renewal terms, and documents.

### CON-03 Claims

Track warranty claims, repair references, vendor outcomes,
replacement equipment, and closure.

### CON-04 Reminders

Generate configurable expiry and notice-deadline reminders.

## 18. Physical Verification

### VER-01 Campaigns

Create scoped verification campaigns with an expected asset snapshot.

### VER-02 Evidence

Record observed tag, location, custodian, condition, verifier,
timestamp, and photographs when required.

### VER-03 Discrepancies

Track missing, unexpected, misplaced, duplicate, or damaged assets.

### VER-04 Reconciliation

Require authorized review before updating authoritative records.
Preserve the original observation and resolution.

## 19. Retirement and Disposal

### DSP-01 Retirement

Require reason, impact review, and configured approval.

### DSP-02 Recovery

Recover licenses, communication services, reusable components,
and assignments where applicable.

### DSP-03 Sanitization

Record whether data sanitization is applicable, method reference,
performer, verification, evidence, and result.

Requirements must be approved by the organization's security owner.

### DSP-04 Disposal

Support resale, recycling, donation, scrapping, and return to owner/vendor.

Capture recipient, date, proceeds when relevant, and certificates.

### DSP-05 Lifecycle boundary

Retirement, awaiting disposal, and completed disposal are distinct.
Disposed assets cannot be assigned or returned to ordinary stock.

### DSP-06 History

Retain historical relationships and evidence under the approved
retention policy.

## 20. Financial Visibility

### FIN-01 Included

Provide acquisition costs, recurring subscriptions, service charges,
repair costs, and disposal proceeds.

### FIN-02 Exactness

Persist and calculate money using exact decimal rules.
Every monetary amount must have a defined currency context.

### FIN-03 Aggregation

Do not total different currencies without an approved exchange-rate
source, rate date, and conversion policy.

### FIN-04 Optional accounting

DECISION REQUIRED:
Approve whether depreciation, capitalization, financial books,
impairment, and journal posting are native or ERP-integrated.

Until approved, do not claim accounting-ledger functionality.

## 21. Documents and Imports

### DOC-01 Attachments

Support invoices, photographs, contracts, handover forms, repair reports,
and disposal evidence through controlled storage and download.

### DOC-02 Access

Document access must inherit approved parent-resource scope.

### IMP-01 Imports

Support approved templates for assets, employees, software,
entitlements, and communication records.

### IMP-02 Validation

Provide preview, row errors, duplicate detection, and commit confirmation.

### IMP-03 Commit semantics

Default proposal: all-or-nothing commit for an approved import.
Partial success requires an explicit product decision.

### IMP-04 Safety

Define file limits, supported formats, retention, checksum identity,
malware/content handling, and safe spreadsheet export behavior.

## 22. Notifications and Approvals

### NTF-01 Notification events

Cover pending approvals, overdue returns, renewals, warranty expiry,
maintenance, discrepancies, failed integrations, and unresolved offboarding.

### NTF-02 Delivery

Provide in-app notifications.
Email and chat channels require approved adapters.

Track queued, delivered, failed, and suppressed outcomes.

### APR-01 Approval policies

Support approved routing by action, scope, value, and responsibility.

### APR-02 Controls

Record approver, decision, reason, policy version, and timestamp.
Revalidate resource version and eligibility at decision time.

### APR-03 No invented authority

Approval thresholds, self-approval rules, escalation, delegation,
and required evidence must be approved before activation.

## 23. Reports and Dashboards

Provide permission-scoped reports for:

- Assets by category, location, custodian, lifecycle, and condition.
- Available stock, reservations, and overdue returns.
- Movements and unconfirmed receipts.
- Repairs, downtime, and maintenance costs.
- Warranty, support, subscription, and notice deadlines.
- License allocation, consumption evidence, and review exceptions.
- Unknown or stale discovered devices.
- Communication subscriptions and recurring charges.
- Verification discrepancies.
- Offboarding recovery.
- Retirement, disposal, and sanitization evidence.
- Purchases and lifecycle costs.

Every calculated metric must document its formula, date basis,
inclusions, exclusions, and handling of missing data.

Exports must apply the same authorization as interactive views.

## 24. State and Workflow Requirements

### 24.1 Separate state dimensions

Hardware must distinguish:

- Lifecycle: received, active, retired, disposed.
- Availability: available, reserved, assigned, in_transit,
  in_repair, quarantined, unavailable.
- Condition: new, good, fair, damaged, nonfunctional, unknown.
- Verification: verified, missing, disputed, not_checked.

Approved implementation decision (2026-10-27): `received` permits
`available`, `quarantined`, or `unavailable`; `active` permits every
availability value, with `reserved`, `assigned`, `in_transit`, and
`in_repair` requiring their corresponding open workflow record; `retired` and
`disposed` permit only `unavailable`. A `nonfunctional` condition permits only
`in_repair`, `quarantined`, or `unavailable`. Condition and verification
otherwise remain independent. Missing or disputed verification never changes
lifecycle, location, or custody. Retired/disposed states are not reversible by
ordinary updates.

Approved implementation decision: Asset Managers may directly register
individually tracked equipment as `received`, without creating a receipt
record. Direct registration is not a posted receipt and does not imply
purchasing or receiving evidence.

### 24.2 Required workflow specifications

For each workflow define:

- Current state.
- Command.
- Eligible actor.
- Required input/evidence.
- Preconditions.
- Resulting state.
- Related record changes.
- Approval requirements.
- Audit/outbox events.
- Concurrency and retry behavior.
- Reversal/correction handling.

Required workflows:

1. Request and fulfillment.
2. Procurement and receiving.
3. Reservation and assignment.
4. Acknowledgment and return.
5. Transfer and receiving.
6. Repair and return to service.
7. License allocation and reclamation.
8. Subscription renewal/termination.
9. Communication service assignment/change.
10. Discovery reconciliation.
11. Verification and discrepancy resolution.
12. Offboarding.
13. Retirement and disposal.

Formal transitions must use named commands, not generic status patches.

## 25. Security, Audit, and Operations

### SEC-01 Authentication

Preserve the approved first-party session model.
Resolve documented authentication adoption gaps before production.

### SEC-02 Audit

Record actor, organization, operation, resource, timestamp,
correlation, reason, and safe change details.

Application logs are not a substitute for business audit.

### SEC-03 Secrets

Do not expose credentials, tokens, license keys, or sensitive document
content in logs, notifications, exports, or unrestricted audit records.

### SEC-04 Session isolation

Identity changes must not expose cached data from another user
or organization.

### OPS-01 Recovery

Define backups, restore procedures, retention, recovery targets,
and deployment rollback before production approval.

### OPS-02 Observability

Provide visibility into API errors, worker failures, import failures,
integration lag, and dead-letter events.

### OPS-03 Accessibility

Use accessible controls, keyboard navigation, meaningful labels,
visible focus, non-color status cues, and usable responsive layouts.

## 26. Decisions Required Before Implementation

| Decision | Required outcome |
|---|---|
| Branding | Product name and approved terminology |
| Deployment | Internal single-organization or multi-organization |
| Login | Unambiguous organization/account lookup |
| Hierarchy | Location/store/department model |
| Roles | Permission catalog and assignment cardinality |
| Approvals | Authority, thresholds, delegation, self-approval |
| Procurement | Native purchase workflow or ERP ownership |
| Financial rules | Currencies, rounding, taxes, optional accounting |
| Licensing | Supported metrics and over-allocation policy |
| Telecom | Usage collection, visibility, retention |
| Discovery | Connectors and field-source precedence |
| Files | Storage, limits, scanning, retention |
| Imports | Commit semantics and duplicate handling |
| Notifications | Approved providers and channels |
| Dates | Organization timezone and date-only rules |
| Capacity | Asset/user/import/event volumes |
| Performance | Measurable latency and throughput targets |
| Recovery | Availability, backup, RPO, and RTO |
| Retention | Audit, employee, contract, and disposal records |
| Offline | Whether offline writes are included |

An unresolved decision must block the affected behavior, not all
unrelated implementation work.

## 27. Acceptance and Traceability

Maintain a requirement-to-test matrix using the IDs in this document.

Minimum release evidence:

- Durable create/read/update behavior after reload.
- Separate-session visibility of committed changes.
- Organization and location scope isolation.
- Correct permissions for actions and exports.
- No duplicate open custody assignments.
- No double fulfillment or stock over-issue under concurrency.
- Correct transfer receipt and location updates.
- Correct license allocation under concurrent requests.
- Honest unknown/stale licensing and discovery states.
- Preserved drafts on rejected frontend mutations.
- Idempotent retry and duplicate-event tests.
- Audit and business changes committed consistently.
- Failed transactions leave no partial business changes.
- Disposal evidence and transition controls.
- Migration testing on an isolated database.
- Tested backup restoration.
- Relevant frontend/backend checks and integration tests.
- No demo fallback or success-shaped failure.

Each completion report must identify changed files, checks actually
run, results, unresolved decisions, and remaining gaps.

Delivery may be sequenced, but sequencing does not remove requirements
from the full application scope.