# IT & Communication Asset Management — Frontend Requirements

Document date: 2026-10-27
Status: Proposed requirements for approval

## 1. Authority and Baseline

Read:

- `../requirement.md`
- `DESIGN.md`
- `../server/DESIGN.md`
- `../server/requirement.md`
- `../AGENTS.md`

The supplied `DESIGN - Copy.md` is this application's `DESIGN.md`.

Preserve the existing React/TanStack/Zustand/shared-UI architecture.

Use the API-backed UOM feature as the integration reference.
Use prototype pages only as visual references.

No frontend feature may claim durable success without a successful
backend operation.

## 2. Frontend Architecture

### FE-ARCH-01

Preserve:

- React and TypeScript.
- TanStack Router, Query, and Table.
- Zustand for approved client/session state.
- React Hook Form and Zod.
- Shared Tailwind/Radix/shadcn-style primitives.
- Shared Axios API boundary.
- pnpm and the existing lockfile.
- Existing browser testing infrastructure.

### FE-ARCH-02

Dependency direction:

Route -> Feature -> Query/mutation hooks -> Typed API -> Shared transport.

### FE-ARCH-03

Keep route files thin.
Do not hand-edit generated route output.

### FE-ARCH-04

Do not introduce a generic CRUD engine or duplicate design system.

## 3. Navigation and Pages

The following navigation is proposed and requires approval against
the existing shell conventions.

### 3.1 Overview

- Dashboard.
- My tasks and approvals.
- Notifications.

### 3.2 Hardware

- Asset register.
- Asset details.
- Reservations.
- Assignments and returns.
- Transfers.
- Accessories and spare stock.
- Labels and imports.

### 3.3 Software and Licenses

- Software catalog.
- Installations.
- Entitlements.
- Allocations.
- Subscriptions and renewals.
- License assessments and exceptions.

### 3.4 Communication

- SIMs and mobile services.
- Telephone numbers and plans.
- Internet/WAN circuits.
- Service assignments.
- Renewals and charges.

### 3.5 Procurement and Coverage

- Asset requests.
- Purchase records.
- Receiving.
- Vendors.
- Warranties and support contracts.

### 3.6 Service and Lifecycle

- Maintenance plans.
- Repair tickets.
- Verification campaigns.
- Offboarding.
- Retirement and disposal.

### 3.7 Integrations and Reporting

- Discovery sources and sync runs.
- Reconciliation queues.
- Reports and exports.
- Business audit.

### 3.8 Administration

- Categories, manufacturers, and models.
- Locations/stores.
- Departments and cost centers.
- Employees.
- Users, roles, and permissions.
- Approved workflow and notification configuration.

### 3.9 Employee self-service

- My equipment.
- My software/service allocations.
- New requests.
- Acknowledge receipt.
- Report a problem.
- Request return.
- View own request history.

Do not expose administration navigation to employees merely because
the route exists.

## 4. Shared List Requirements

### FE-LIST-01

Every live list must include:

- Title and concise description.
- Permission-aware primary action.
- Supported search and filters.
- Server-backed pagination and totals.
- Stable row identity.
- Accessible row actions.
- Initial loading, empty, error, and refetch states.
- Clear active filters and reset behavior.

### FE-LIST-02

Persist shareable search/filter/page state in validated route search.

### FE-LIST-03

Convert zero-based table page indexes to one-based API pages.

### FE-LIST-04

Only show global sorting when the API supports it.
Otherwise disable it or explicitly identify page-local sorting.

### FE-LIST-05

Bulk actions must state whether selection applies to the current page,
explicit selected IDs, or all filtered results.

Never silently apply actions beyond the visible selection contract.

## 5. Hardware Screens

### FE-HW-01 Asset list

Provide filters for category, location, department, custodian,
lifecycle, availability, condition, and warranty expiry.

### FE-HW-02 Asset details

Provide relevant tabs or sections:

- Overview.
- Specifications.
- Custody.
- Movements.
- Components/accessories.
- Software.
- Communication services.
- Maintenance.
- Purchase and coverage.
- Documents.
- Timeline.
- Retirement/disposal.

Only show protected cost or employee fields when authorized.

### FE-HW-03 Forms

Use category-specific specification fields.
Preserve serials and tags as strings.

### FE-HW-04 Labels

Provide authorized label preview and print.
Scanning must resolve through authenticated application access.

## 6. Workflow Screens

### FE-WF-01 Common behavior

Workflow pages must show:

- Current state.
- Relevant version.
- Actor-eligible actions.
- Required input and evidence.
- Approval history.
- Outstanding prerequisites.
- Resulting server state after completion.

### FE-WF-02 Assignment/return

Support recipient selection, due date, condition, accessories,
acknowledgment, and return inspection.

### FE-WF-03 Transfer

Show source, destination, line-level dispatch/receipt, and discrepancies.

### FE-WF-04 Receiving

Show ordered, previously received, remaining, accepted, and rejected
quantities using server-authoritative values.

### FE-WF-05 Offboarding

Provide a cross-module checklist with unresolved exceptions.
Do not mark external account removal complete based only on local allocation changes.

### FE-WF-06 Approval

Require explicit confirmation and a reason where configured.

### FE-WF-07 Retirement

Show pending recovery, sanitization, approval, and disposal evidence.
Do not combine retirement and completed disposal into one action.

## 7. Software and Licensing Screens

### FE-LIC-01 Catalog

Display publisher, product, edition, approved policy, and discovered mappings.

### FE-LIC-02 Entitlements

Show metric, units, term, dates, restrictions, contract, and evidence.

### FE-LIC-03 Allocation

Use user/device selectors matching the entitlement metric.

### FE-LIC-04 Evaluation

Display separately:

- Purchased capacity.
- Allocated capacity.
- Measured consumption.
- Evidence freshness.
- Evaluation result.
- Unresolved interpretation.

Do not display a green “compliant” label when evidence is unavailable.

### FE-LIC-05 Renewals

Show renewal date and cancellation/notice deadline separately.

### FE-LIC-06 Secrets

Never render secret license material in ordinary list columns,
tooltips, browser logs, or unrestricted downloads.

## 8. Communication Screens

### FE-TEL-01

Provide service detail views linking provider, plan, user, device,
location, contract, and assignment history.

### FE-TEL-02

Preserve telephone numbers and SIM identifiers as strings.

### FE-TEL-03

Distinguish requested service changes from provider-confirmed outcomes.

### FE-TEL-04

Mask sensitive identifiers according to server-authorized policy.

## 9. Maintenance and Verification

### FE-MNT-01

Provide ticket list/detail, work notes, cost entries, parts, attachments,
downtime intervals, and explicit transition actions.

### FE-MNT-02

Show equipment operational state separately from ticket status.

### FE-VER-01

Provide campaign scope, expected assets, scan/manual observation,
discrepancies, and reconciliation review.

### FE-VER-02

A scan records an observation; it must not silently rewrite location
or custody.

## 10. Discovery and Integration Screens

### FE-DSC-01

Show connector status, last success, last attempt, errors,
source timestamps, and observation freshness.

### FE-DSC-02

Provide side-by-side reconciliation of discovered and registered data.

### FE-DSC-03

Explain which fields are authoritative from which source.

### FE-DSC-04

Require confirmation for merge/link decisions.
Do not silently accept ambiguous matches.

## 11. Documents and Imports

### FE-DOC-01

Show upload progress, validation, processing, failure, and availability.

### FE-DOC-02

Downloads must use authorized server-generated access.
Do not construct storage URLs from guessed keys.

### FE-IMP-01

Provide:

1. Template instructions.
2. File selection.
3. Upload and validation state.
4. Preview and row errors.
5. Explicit commit confirmation.
6. Final commit outcome.
7. Error export where supported.

### FE-IMP-02

A successful HTTP response with failed import status must be displayed
as an import failure, not a success toast.

### FE-IMP-03

Preserve the file/job reference needed to resume status viewing.
Do not persist sensitive file contents in browser storage.

## 12. Forms and Validation

### FE-FORM-01

Use React Hook Form and Zod aligned with server DTOs.

### FE-FORM-02

Define create, edit, read, and command shapes separately where needed.

### FE-FORM-03

Preserve dirty input on validation, network, authorization,
and concurrency failures.

### FE-FORM-04

Do not reset drafts merely because background data refetched.

### FE-FORM-05

Disable duplicate submission while pending.
Maintain logical command identity across approved retries.

### FE-FORM-06

Use searchable server-backed selectors with explicit pagination.

### FE-FORM-07

Treat money and exact quantities as decimal strings until deliberate
display formatting. The server owns authoritative totals.

## 13. API and Error Handling

### FE-API-01

Use the shared typed API boundary.
Do not create ad-hoc HTTP clients inside components.

### FE-API-02

Preserve direct endpoint response bodies and existing problem details.

### FE-API-03

Support errors without a problem body, status, or correlation ID.

### FE-API-04

Distinguish:

- 401/session expiration.
- 403/forbidden.
- 404/unavailable resource.
- Validation failure.
- 409/conflict.
- Rate limiting.
- Network/server failure.

### FE-API-05

On stale-version conflict:

- Keep the draft.
- Explain that the server record changed.
- Offer reload/review.
- Do not silently resubmit with a new version.

### FE-API-06

Unknown network outcomes must not encourage creation of a new logical
command before checking the existing operation outcome.

### FE-API-07

Never show success or close the only draft after a rejected mutation.

## 14. State and Cache

### FE-STATE-01 Ownership

- Server records: TanStack Query.
- Form drafts: React Hook Form.
- Session: existing in-memory auth store.
- Shareable list state: route search.
- Presentation state: component/context or approved Zustand state.

### FE-STATE-02

Do not duplicate live records in prototype stores.

### FE-STATE-03

Approve and implement identity/scope-qualified cache boundaries,
plus cancellation/removal of sensitive data on identity changes.

### FE-STATE-04

Invalidate all affected projections after mutations, including:

- Lists and details.
- Availability and counters.
- Custody and employee views.
- Stock and reservations.
- License capacity.
- Notifications and approvals.
- Related reports where applicable.

### FE-STATE-05

Do not use optimistic final-state updates for approvals, custody,
stock, licensing capacity, or financial operations by default.

## 15. Authentication and Permissions

### FE-AUTH-01

Preserve first-party login, refresh, `/auth/me`,
forced-password-change, and logout flows.

### FE-AUTH-02

Do not persist access tokens in localStorage/sessionStorage.

### FE-AUTH-03

Wire permission-aware navigation into the active sidebar.

### FE-AUTH-04

Provide route/action UX gating without treating it as authorization.

### FE-AUTH-05

Clear sensitive cached records and drafts as required during logout,
session loss, or identity transition.

### FE-AUTH-06

Do not introduce Clerk or another auth system without an approved migration.

## 16. Reports and Dashboards

### FE-RPT-01

Display only server-calculated or explicitly non-authoritative metrics.

### FE-RPT-02

Show filters, date range, currency, last refresh, and definition where relevant.

### FE-RPT-03

Do not combine currencies without approved converted totals.

### FE-RPT-04

Display asynchronous report/export progress and failures.

### FE-RPT-05

Dashboard links must open the corresponding filtered list where supported.

## 17. Accessibility and Responsive Behavior

- Use semantic shared components and theme tokens.
- Preserve light/dark mode and existing direction conventions.
- Provide accessible names for icon-only actions.
- Associate labels, descriptions, and errors with controls.
- Preserve dialog focus trapping and restoration.
- Support keyboard operation and visible focus.
- Use text as well as color for status.
- Keep tables usable on narrow screens.
- Provide manual input fallback for scanning workflows.
- Do not imply offline capability when connectivity is required.

DECISION REQUIRED:
Approve the formal accessibility conformance target and supported
browser/device matrix.

## 18. Frontend Verification

Required tests include:

- Route and active navigation integration.
- Permission and forced-password-change behavior.
- API payload/response mapping.
- Pagination, filtering, and supported sorting.
- Decimal/date display handling.
- Form validation and dirty-draft preservation.
- Pending and duplicate-submission behavior.
- Failed mutation and stale-version handling.
- Import business failure inside a 2xx response.
- Session/cache isolation.
- Unknown/stale licensing and discovery states.
- Line-level transfer/receiving outcomes.
- Keyboard, focus, responsive, and theme behavior.
- Real persisted workflows through approved integration tests.

Use the existing Vitest browser/Playwright tooling.
Generate route types through configured tooling.

Run relevant tests, build, lint, and formatting checks.
Do not claim checks cover files excluded by their configuration.

## 19. Completion Definition

A frontend feature is complete only when:

- The correct route and active navigation are wired.
- Its backend endpoint is registered and durable.
- Permissions and scopes behave correctly.
- Data survives reload.
- A separate authorized session observes committed changes.
- Errors preserve user work.
- Dependent queries refresh correctly.
- No prototype fallback remains in the live path.
- Relevant tests and builds pass or baseline failures are documented.
- Remaining decisions and limitations are reported.