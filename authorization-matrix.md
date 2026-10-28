# Approved Authorization Matrix

**Status: Approved baseline (2026-10-27); implementation is incremental.**

This matrix applies the approved eight-role catalog to the product scope. It
does not authorize a workflow whose business rules are still marked DECISION
REQUIRED in `requirement.md`.

## Role-to-capability matrix

`Read` means view in the actor's scope. `Manage` means create and update
records through approved commands; it never means hard-delete history or
bypass a lifecycle transition.

| Role | Administration | Hardware and stock | Custody and movement | Maintenance | Software and licenses | Communications | Procurement and finance | Approvals and audit |
|---|---|---|---|---|---|---|---|---|
| Administrator | Manage organization configuration, users, roles, permissions, and integration configuration | No operational access by default | No operational access by default | No operational access by default | No operational access by default | No operational access by default | No cost access by default | No business approval by default; read audit events only when separately granted |
| Asset Manager | Read operational masters | Manage assets, accessories, and stock within assigned location scope | Manage reservations, assignment, return, transfer, and verification commands within scope; submit retirement requests | Read repair status | No access by default | No access by default | No cost or contract access by default | Read related history; no approval authority by default |
| Technician | Read work-related masters | Read only asset/part data needed for assigned work | No custody or transfer commands | Manage only assigned repair and maintenance work; record parts and evidence | No access by default | No access by default | No cost or contract access | Read work-related history; no approval authority |
| Software/License Manager | Read software-related masters | No hardware write access | No custody or transfer commands | No access by default | Manage catalog, installations, entitlements, allocations, and renewal records within organization scope | No access by default | No purchase or contract-cost access by default | Read licensing history; approval authority only if separately approved |
| Procurement/Finance | Manage vendor and procurement masters | Read procurement references | No custody or transfer commands | Read approved repair-cost fields only | Read purchasing and contract references only | No access by default | Manage purchase and receiving records and approved cost fields within assigned scope; native purchase-order authoring remains blocked pending its decision | Read procurement history; no approval authority by default |
| Manager/Approver | No administration | Read records attached to assigned approval tasks | Read assigned request/movement evidence | Read records attached to assigned tasks | Read records attached to assigned tasks | Read records attached to assigned tasks | Read only fields needed for assigned decisions | Decide only assigned approval tasks after authority, thresholds, self-approval, delegation, and evidence rules are approved; otherwise read-only |
| Employee | No administration | Read own assigned equipment and related acknowledgments | Create own requests/issues; acknowledge own assignment and return; no direct custody edits | Create or view own issue reports | View own assigned software/services only where linked | View own assigned services only where linked | No access | View own request status; no approval authority |
| Auditor | No administration | Read-only in explicitly granted audit scope | Read-only in explicitly granted audit scope | Read-only in explicitly granted audit scope | Read-only in explicitly granted audit scope; secrets masked | Read-only in explicitly granted audit scope; sensitive identifiers masked | Read-only only for explicitly granted cost/contract fields | Read-only audit evidence and exports only when separately granted |

## Required scope checks

Every allow decision is the intersection of:

1. The actor's authenticated organization.
2. The assigned role's action permission.
3. Explicit location/store scope where the resource is location-scoped.
4. Resource scope: assigned work, the employee's own records, assigned approval tasks, or explicitly granted audit scope.
5. Current workflow eligibility and referenced-record scope.

Apply the same checks to lists, counts, nested references, attachments,
imports, exports, reports, and worker work. Organization or resource IDs
provided by a client never grant scope. Documents inherit their parent
resource's scope. Role changes and account deactivation invalidate active
sessions. No role grants hard deletion of posted history.

## Restricted fields

- **Costs and approved cost fields:** Procurement/Finance only unless another
  field-specific permission is approved.
- **Employee details:** expose only the minimum identity data required by an
  assigned operation; do not add general HR records.
- **Contract terms:** Procurement/Finance only, within assigned scope.
- **License secrets:** deny by default; require a separate `secret.read`
  permission for designated Software/License Managers. Mask secrets in lists,
  logs, exports, and audit views.
- **Communication identifiers and usage:** deny sensitive identifiers and
  usage details by default. The accountable role, collected fields, and
  retention remain undecided.
- **Audit evidence:** read-only, scoped, and separately permissioned; this
  matrix does not claim database-enforced immutable audit.

## Decisions that still block domain authorization

- The approved hierarchy is Organization → parent/child Locations → Stores
  attached to a Location. A grant at a Location includes the Location, all
  descendant Locations, and every Store in that subtree.
- Identify who manages communication resources; the approved role catalog has
  no dedicated telecom role.
- Approve purchase-order ownership before enabling native authoring.
- Approve approval thresholds, self-approval, delegation, escalation, and
  required evidence before enabling approval commands.
- Approve usage collection, sensitive field access, and retention for
  communication services.
- Define the employee-to-login identity link before enabling employee
  self-service.

Implement approved permissions only for domains whose data model, scope
semantics, and workflow rules are resolved. The existing Administrator-only
user-management boundary remains separate.
