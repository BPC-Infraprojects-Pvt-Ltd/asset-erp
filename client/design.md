# IT & Communication Asset Management — Frontend Design

Document date: 2026-10-27
Status: Template-based architecture contract and implementation target

## 1. Purpose and Authority

This document adapts the supplied frontend template, originally named
`DESIGN - Copy.md`, for IT & Communication Asset Management.

Read with:

- `../AGENTS.md`
- `../requirement.md`
- `./requirement.md`
- `../server/design.md`
- `../server/requirement.md`

### Labels

- BASELINE: reported by the supplied template documentation.
- RULE: boundary for new or changed code.
- TARGET: capability requiring implementation.
- GAP: unresolved limitation.
- DECISION REQUIRED: approval needed before implementation.

No current repository source or installed versions have been independently
verified for this document.

Source, registered routes, migrations, consumers, and tests establish
implementation status. Requirements establish intended behavior.

## 2. Architecture

### 2.1 Stack [BASELINE / RULE]

Preserve the supplied choices:

| Concern | Choice |
|---|---|
| UI | React and TypeScript |
| Build | Vite |
| Routing | TanStack Router, file-based routes |
| Server state | TanStack Query |
| Tables | TanStack Table |
| HTTP | Shared Axios client |
| Session/transient state | Zustand |
| Forms | React Hook Form and Zod |
| UI primitives | Existing Radix/shadcn-style components |
| Styling | Tailwind and existing semantic tokens |
| Feedback/visuals | Existing Sonner, Lucide, Recharts |
| Testing | Vitest browser mode with Playwright |
| Package manager | pnpm |

Declared versions and installed versions must be verified from the
actual manifest and lockfile. Do not copy version ranges as a claim
of compatibility or upgrade packages incidentally.

### 2.2 Runtime flow

Browser entry
→ existing providers
→ TanStack Router
→ authenticated route/layout
→ feature page
→ feature query/mutation hooks
→ typed API module
→ shared Axios transport
→ NestJS `/api/v1`.

Preserve the template provider composition:

1. QueryClientProvider.
2. ThemeProvider.
3. FontProvider.
4. DirectionProvider.
5. RouterProvider.

Verify the actual bootstrap before changing it.

### 2.3 State ownership [RULE]

| State | Owner |
|---|---|
| Persisted records and server projections | TanStack Query |
| Form drafts | React Hook Form |
| Shareable filters/pagination | Validated route search |
| Session | Existing in-memory auth store |
| Dialog/tab/selection state | Component state or established UI context |
| Presentation preferences | Existing providers/cookies |
| Demo data | Explicitly isolated demo routes only |

Do not duplicate live records in Zustand and Query.

## 3. Baseline Versus Target

### 3.1 Supplied template baseline

The supplied design reports API integration for:

- First-party authentication.
- Users, roles, and permissions.
- Sites and stores.
- UOMs and conversions.
- A partial BOQ import flow.

It reports browser-only or prototype behavior for several inventory,
vendor, and procurement screens.

These observations are template evidence, not proof of implementation
in a new or copied repository.

### 3.2 ITAM target

The following require end-to-end implementation and verification:

- Hardware registry.
- Custody, reservations, and returns.
- Transfers and receiving.
- Accessory/spare inventory.
- Software and entitlements.
- Communication services.
- Repairs and maintenance.
- Contracts and renewals.
- Discovery reconciliation.
- Verification campaigns.
- Offboarding.
- Retirement/disposal.
- Documents, audit, reports, and notifications.

Do not reuse BOQ-specific behavior as the general import contract.

## 4. File Ownership

Preserve existing conventions:

| Path | Responsibility |
|---|---|
| `src/main.tsx` | Bootstrap and global query/router policies |
| `src/routes` | Route entry, search validation, route-level gating |
| `src/routeTree.gen.ts` | Generated output |
| `src/features` | Domain pages, forms, tables, queries |
| `src/lib/api` | Shared transport and typed endpoint functions |
| `src/components/layout` | Active shell/sidebar/header |
| `src/components/ui` | Shared presentation primitives |
| `src/components/data-table` | Shared table controls |
| `src/stores` | Session and approved transient state |
| `src/styles` | Theme tokens and shared styling |
| `src/test-utils` | Testing utilities |

### Proposed feature ownership [TARGET]

Use focused feature areas such as:

- `assets`
- `custody`
- `movements`
- `procurement`
- `software`
- `licenses`
- `communication`
- `maintenance`
- `contracts`
- `verification`
- `offboarding`
- `retirement`
- `discovery`
- `reports`
- `masters`

Confirm exact names against existing source before creating directories.

Do not reorganize unrelated template folders solely for consistency.

### Dependency direction [RULE]

Route → feature → hooks/forms/shared UI.
Query hooks → typed API module → shared transport.

Shared UI must not import domain APIs or licensing/workflow rules.

## 5. Routing and Navigation

### 5.1 Authenticated shell

Place application routes beneath the existing authenticated branch.

Preserve:

- Session bootstrap.
- Forced-password-change flow.
- Loading/error boundaries.
- Skip navigation.
- Responsive layout.
- Theme and direction conventions.

### 5.2 Proposed navigation [TARGET]

- Overview.
- Hardware.
- Software and Licenses.
- Communication.
- Requests and Procurement.
- Maintenance and Contracts.
- Verification and Offboarding.
- Retirement and Disposal.
- Discovery and Integrations.
- Reports.
- Administration.
- My Assets / Self-Service.

Navigation restructuring requires approval under the shared UI boundary.

### 5.3 Permission-aware navigation

Wire permission filtering into the active sidebar, not merely an
unused helper or example shell.

Route/action visibility is UX only. The server remains authoritative.

A hidden action is not a security control.

### 5.4 Route state

Validate URL parameters for:

- Search.
- Page and page size.
- Filters.
- Tabs.
- Supported sorting.
- Resource IDs where applicable.

Do not hand-edit generated route types.
Use configured router tooling and verify the resulting build.

## 6. Authentication and Cache Isolation

### 6.1 Session baseline

The supplied template uses:

- Email/password login.
- Access token returned in the response.
- Access token held in memory.
- HttpOnly refresh cookie.
- `/auth/me` for identity, permissions, and scope.
- Bounded refresh retry.
- Shared refresh promise for concurrent requests.
- Forced-password-change routing.

Keep this shape unless an auth migration is approved.

### 6.2 Known gaps

The supplied design reports:

- Sensitive query caches are not consistently cleared on logout/reset.
- Existing query roots are not identity-qualified.
- Active sidebar permission filtering is incomplete.
- Query and mutation final-401 handling differ.

Resolve these before protected multi-user rollout.

### 6.3 Target cache boundary

Approve a shared key convention that includes the relevant:

- Organization.
- Actor.
- Scope/session generation.

A scope/session generation is a client isolation marker, not server authority.

On logout, identity change, or incompatible scope change:

1. Cancel sensitive requests.
2. Remove protected cached results.
3. Reset relevant transient state.
4. Prevent late responses from repopulating the previous identity's cache.
5. Refresh identity/permission context before protected requests resume.

Do not use previous-identity data as placeholder data.

Do not persist tokens or business records in browser storage as a workaround.

## 7. API Contract

### 7.1 Shared transport

Use the existing shared Axios boundary.

Preserve:

- `/api/v1`.
- Credentials for refresh-cookie transport.
- Bearer token injection.
- Correlation IDs.
- Bounded auth retry.

Do not add per-component HTTP clients.

Timeouts, cancellation, and general retry policies require a coordinated
shared-transport decision and tests.

### 7.2 Response conventions

- Endpoint functions return body data, not raw Axios responses.
- No universal `{ success, data }` wrapper.
- Paged lists use `items`, `page`, `pageSize`, and `total`.
- API pages are one-based.
- Exact decimals are strings.
- Date-only values and timestamps are distinct.
- Filters and sorting must match the specific endpoint contract.

Do not assume arbitrary partial PATCH semantics.

### 7.3 Errors

Use the existing problem-details shape where present:

- `type`
- `title`
- `status`
- `detail`
- `instance`
- `correlationId`

Also handle network errors and non-problem responses.

Do not treat `about:blank` as a useful domain error code.

### 7.4 Error behavior

Distinguish:

- Initial load failure.
- Background refresh failure.
- Validation failure.
- Session expiry.
- Forbidden access.
- Missing/inaccessible record.
- Version conflict.
- Rate limit.
- Unknown command outcome.

Keep safe correlation information available for support.

Avoid duplicate global/component notifications.

## 8. Queries and Mutations

### 8.1 Query rules

- Include all server-affecting filters in query keys.
- Keep key factories inside the owning feature.
- Use approved identity isolation.
- Do not fetch one page and present it as a complete selector.
- Preserve valid content during background refetch.
- Do not replace failed data with seeds.

### 8.2 Mutation rules

A mutation receives:

- Typed command input.
- Resource version where required.
- Logical command identity where required.

Retain the same idempotency key for an approved retry of the same
logical command. A changed command receives a new key.

Do not silently regenerate keys during an unknown-outcome retry.

### 8.3 Conflict handling

On 409:

- Keep the user's draft.
- Explain the conflict.
- Offer explicit reload/review.
- Do not overwrite with a fresh version automatically.

### 8.4 Invalidation

Invalidate affected:

- Lists and details.
- Counters and availability.
- Custodian views.
- Stock/reservations.
- License capacity.
- Approvals/notifications.
- Related report projections.

Do not display final success based on an optimistic local workflow state.

## 9. UI Patterns

### 9.1 Master lists

Use the established page shell with:

1. Title and short description.
2. Permission-aware primary action.
3. Search/filter toolbar.
4. Server-backed table.
5. Pagination and total.
6. Clear loading/empty/error states.
7. Accessible row actions.
8. Shared create/edit form.

Do not label page-local sorting as global sorting.

### 9.2 Detail pages

Use detail pages for aggregates that need history and related records.

Hardware detail sections may include:

- Overview.
- Specifications.
- Custody and movement.
- Components/accessories.
- Software and communication.
- Maintenance.
- Purchase and coverage.
- Documents.
- Timeline.
- Retirement/disposal.

Only show sections supported by approved APIs.
Do not invent tabs backed by mock data in a live feature.

### 9.3 Forms

- Use React Hook Form and Zod.
- Align normalization and constraints with server DTOs.
- Preserve leading zeros in identifiers.
- Keep drafts on rejected mutations.
- Do not reset dirty input on background refetch.
- Disable duplicate submission while pending.
- Associate errors with controls.
- Use searchable, paginated server selectors.

### 9.4 Bulk actions

Define whether selection covers:

- Current page.
- Explicit IDs.
- All filtered results.

Require the corresponding server contract and version strategy.

Do not silently expand the selection.

## 10. Domain Presentation Rules

### 10.1 Hardware

Show lifecycle, availability, condition, and verification separately.

A damaged assigned asset must not be forced into one ambiguous status.

### 10.2 Custody and movement

Show confirmed location separately from intended destination.
Track acknowledgment and physical receiving independently when required.

### 10.3 Licensing

Separate:

- Purchased entitlement.
- Allocation.
- Measured consumption.
- Validity dates.
- Evidence freshness.
- Evaluation outcome.

Support unknown and needs-review displays.

Do not infer compliance solely from installed counts.

### 10.4 Communication

Distinguish local requests from carrier-confirmed changes.
Preserve telephone/SIM identifiers as strings.

### 10.5 Discovery

Show source, last observation, conflicts, and field ownership.
Require explicit review for ambiguous links/merges.

### 10.6 Maintenance

Show ticket state separately from asset operational availability.
Present downtime according to server-defined intervals.

### 10.7 Retirement

Retired, awaiting disposal, and disposed are different states.
Expose required recovery and sanitization evidence before completion.

## 11. Workflow UI

Before implementing a workflow, approve:

- State/command table.
- Actor eligibility.
- Mandatory evidence.
- Preconditions.
- Resulting state.
- Related effects.
- Version semantics.
- Retry/correction behavior.

Use explicit actions such as:

- Submit.
- Approve.
- Reject.
- Dispatch.
- Receive.
- Acknowledge.
- Return.
- Verify.
- Retire.
- Complete disposal.

Do not implement formal actions as local array changes.

A server rejection must preserve the draft and provide a safe,
actionable explanation.

## 12. Documents, Imports, and Scanning

### Documents

Show upload/processing/failed/available states.
Use authorized download access.
Do not derive storage URLs from guessed object keys.

### Imports

Provide:

1. Template guidance.
2. File selection.
3. Validation progress.
4. Preview and row errors.
5. Commit confirmation.
6. Final result.

Inspect business status even when HTTP returns 2xx.

### Scanning

Provide manual-input fallback.
A scan records or retrieves information; it does not independently
authorize access or update custody/location.

### Offline boundary

Offline writes are not part of the baseline.

Do not queue business mutations in local storage without an approved
offline, conflict, retention, and security design.

## 13. Dates, Numbers, and Accessibility

### Dates and numbers

- Keep decimal strings until deliberate formatting.
- Server calculations are authoritative.
- Do not aggregate different currencies locally.
- Preserve date-only values without unintended timezone conversion.
- Approve locale, timezone, and rounding conventions centrally.

### Accessibility

- Use semantic tokens and existing shared primitives.
- Preserve keyboard operation and visible focus.
- Label icon-only actions.
- Associate descriptions/errors with fields.
- Preserve dialog focus trapping/restoration.
- Use text as well as color for statuses.
- Keep wide tables usable on narrow screens.
- Test scanning/manual entry and custom selectors.

The formal conformance target and supported browser/device matrix
remain approval decisions.

## 14. Testing and Completion

Use existing browser tests and shared test utilities.

Test:

- Routes and active navigation.
- Permission and password-change behavior.
- API mapping.
- Pagination/filtering/sorting.
- Draft preservation.
- Conflicts and failed mutations.
- Import failures inside successful HTTP responses.
- Session/cache isolation.
- Duplicate-submit and retry identity.
- Domain-specific unknown/stale states.
- Keyboard, responsive, and theme behavior.

Verify actual manifest scripts before execution.

The supplied template examples include:

- `pnpm test`
- `pnpm build`
- `pnpm lint`
- `pnpm format:check`

Use focused tests first, then required broader checks.
Generate route output through configured tooling.

Do not claim runtime checks were run for documentation-only work.

## 15. Adoption Decisions and Release Gates

| Area | Required decision or evidence |
|---|---|
| Branding | Product name and terminology |
| Navigation | Approved groups and feature routes |
| Identity | Auth/session hardening and tenant contract |
| Permissions | Role/action matrix and scope |
| Cache | Identity isolation and logout behavior |
| API | Approved endpoint/filter/version contracts |
| Workflow | State/command tables |
| Numbers/dates | Currency, rounding, timezone |
| Documents | Upload/access/import behavior |
| Accessibility | Conformance and device/browser targets |
| Readiness | No live path dependent on prototype stores |

Record approved deviations with:

- Date.
- Decision.
- Reason.
- Affected contracts.
- Rollout/migration plan.
- Verification.

No deviation is approved solely by appearing in this document.