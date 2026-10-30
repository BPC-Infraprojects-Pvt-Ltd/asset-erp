export interface ModulePageDefinition {
  id: string;
  title: string;
  description: string;
  capabilities: string[];
  decisionNote?: string;
}

export interface ModulePageGroup {
  id: string;
  title: string;
  pages: ModulePageDefinition[];
}

export const modulePageGroups: ModulePageGroup[] = [
  {
    id: "work-queue",
    title: "Work queue",
    pages: [
      {
        id: "my-tasks-approvals",
        title: "My tasks & approvals",
        description:
          "Review work assigned to the signed-in user and any future authorized approval tasks.",
        capabilities: [
          "Assigned work and outstanding prerequisites",
          "Evidence and approval history",
          "Explicit server-confirmed outcomes",
        ],
        decisionNote:
          "Approval authority, thresholds, self-approval, delegation, and required evidence must be approved before approval actions are enabled.",
      },
      {
        id: "notifications",
        title: "Notifications",
        description:
          "Review in-app notices for assigned work, renewals, verification, and integration outcomes.",
        capabilities: [
          "Notification type and related record",
          "Queued, delivered, failed, or suppressed status",
          "Unread and historical notices",
        ],
      },
    ],
  },
  {
    id: "hardware",
    title: "Hardware",
    pages: [
      {
        id: "reservations",
        title: "Reservations",
        description:
          "Plan equipment reservations and availability without changing asset custody.",
        capabilities: [
          "Reservation requests and eligibility",
          "Start and expiry dates",
          "Availability and cancellation history",
        ],
      },
      {
        id: "assignments-returns",
        title: "Assignments & returns",
        description:
          "Manage the future handover, acknowledgment, and return experience for individually tracked equipment.",
        capabilities: [
          "Recipient, purpose, and expected return date",
          "Condition and accessory handover",
          "Return inspection and follow-up",
        ],
      },
      {
        id: "transfers",
        title: "Transfers",
        description:
          "Track equipment movement from source through dispatch and confirmed receipt.",
        capabilities: [
          "Source and destination",
          "Dispatch and receipt by asset",
          "Discrepancy review",
        ],
      },
      {
        id: "accessories-stock",
        title: "Accessories & spare stock",
        description:
          "Manage quantity-tracked IT accessories with server-derived balances and visible transaction history.",
        capabilities: [
          "Receipts, issues, returns, store transfers, and reservations",
          "Whole-unit balances derived from the stock ledger",
          "Tracking mode fixed by category; adjustments deferred pending policy",
        ],
      },
      {
        id: "labels",
        title: "Labels",
        description:
          "Prepare authorized asset labels that resolve through the signed-in application.",
        capabilities: [
          "Label preview",
          "Asset tag and QR/barcode reference",
          "Print-ready layout",
        ],
      },
      {
        id: "asset-imports",
        title: "Asset imports",
        description:
          "Validate bounded CSV asset files, review row errors, and commit all valid rows atomically.",
        capabilities: [
          "UTF-8 CSV only, bounded size and row count",
          "Checksum-bound preview with row-level validation errors",
          "Explicit all-or-nothing commit and status history",
        ],
      },
    ],
  },
  {
    id: "software",
    title: "Software & licenses",
    pages: [
      {
        id: "software-catalog",
        title: "Software catalog",
        description:
          "Maintain canonical software products, publishers, editions, and approved classifications.",
        capabilities: [
          "Publisher and product catalog",
          "Edition and version details",
          "Discovered-name mappings",
        ],
      },
      {
        id: "installations",
        title: "Installations",
        description:
          "Review software installation observations with their source and freshness.",
        capabilities: [
          "Product and device",
          "Source and observation timestamps",
          "Present, stale, unknown, and confirmed-absent states",
        ],
      },
      {
        id: "entitlements",
        title: "Entitlements",
        description:
          "Track purchased software rights, metrics, terms, evidence, and coverage dates.",
        capabilities: [
          "Metric, units, and term",
          "Effective, expiry, renewal, and notice dates",
          "Contract references and evidence",
        ],
      },
      {
        id: "license-allocations",
        title: "Allocations",
        description:
          "Review user- and device-based entitlement allocations against their licensing metric.",
        capabilities: [
          "Eligible user or device targets",
          "Allocation history",
          "Purchased and allocated capacity",
        ],
      },
      {
        id: "subscriptions-renewals",
        title: "Subscriptions & renewals",
        description:
          "Organize software subscriptions, renewal dates, and cancellation notice deadlines.",
        capabilities: [
          "Renewal calendar",
          "Notice and termination deadlines",
          "Owner and renewal history",
        ],
      },
      {
        id: "license-assessments",
        title: "License assessments",
        description:
          "Review entitlement, allocation, consumption evidence, and freshness separately.",
        capabilities: [
          "Purchased, allocated, and measured capacity",
          "Evidence freshness and unresolved interpretation",
          "Unknown and needs-review outcomes",
        ],
      },
    ],
  },
  {
    id: "communication",
    title: "Communication",
    pages: [
      {
        id: "mobile-services",
        title: "SIMs & mobile services",
        description:
          "A future register for mobile service, provider, plan, and service lifecycle details.",
        capabilities: [
          "Provider, account, plan, and service dates",
          "SIM and telephone identifiers kept as strings",
          "Requested versus provider-confirmed changes",
        ],
        decisionNote:
          "Communication-resource ownership, sensitive identifier visibility, and usage retention require approval before access is enabled.",
      },
      {
        id: "telephone-plans",
        title: "Telephone numbers & plans",
        description:
          "Organize telephone numbers, service plans, and provider relationships.",
        capabilities: [
          "Telephone number and plan references",
          "Provider and service dates",
          "Sensitive identifiers masked by policy",
        ],
        decisionNote:
          "The responsible role and rules for sensitive communication data have not been approved.",
      },
      {
        id: "internet-circuits",
        title: "Internet & WAN circuits",
        description:
          "Track circuit references, service locations, bandwidth, and support coverage.",
        capabilities: [
          "Provider and circuit reference",
          "Service type, bandwidth, and installation location",
          "Contract and support dates",
        ],
        decisionNote:
          "Communication-resource ownership and visibility rules have not been approved.",
      },
      {
        id: "service-assignments",
        title: "Service assignments",
        description:
          "Link communication services to users, devices, and locations with assignment history.",
        capabilities: [
          "Service-to-user and service-to-device links",
          "Replacement and reassignment history",
          "Requested and confirmed provider outcomes",
        ],
        decisionNote:
          "Communication-resource ownership and employee identity-link rules require approval.",
      },
      {
        id: "communication-renewals",
        title: "Renewals & charges",
        description:
          "Review communication service dates and approved recurring charge summaries.",
        capabilities: [
          "Renewal and notice dates",
          "Service charge history",
          "Currency-aware reporting",
        ],
        decisionNote:
          "Usage collection, financial visibility, and retention require approval.",
      },
    ],
  },
  {
    id: "procurement",
    title: "Requests & procurement",
    pages: [
      {
        id: "requests",
        title: "Requests",
        description:
          "Capture equipment, software, accessory, and communication requests for future approved workflows.",
        capabilities: [
          "Purpose, quantity, required date, and justification",
          "Request status and history",
          "Approved fulfillment references",
        ],
      },
      {
        id: "purchase-records",
        title: "Purchase records",
        description:
          "Organize purchase references, lines, supporting documents, and approved cost fields.",
        capabilities: [
          "Vendor and invoice references",
          "Purchase lines and receiving references",
          "Currency-aware cost visibility",
        ],
        decisionNote:
          "Native purchase-order authoring is blocked until ownership is approved.",
      },
      {
        id: "receiving",
        title: "Receiving",
        description:
          "Review ordered, received, accepted, and rejected quantities using server-authoritative values.",
        capabilities: [
          "Partial receipt progress",
          "Inspection and serial capture",
          "Asset creation and receiving evidence",
        ],
      },
      {
        id: "vendors",
        title: "Vendors",
        description:
          "Maintain organization-scoped vendors and service providers for approved procurement workflows.",
        capabilities: [
          "Vendor and provider identity",
          "Active and historical references",
          "Related purchase and coverage records",
        ],
      },
      {
        id: "warranties-contracts",
        title: "Warranties & support contracts",
        description:
          "Review equipment coverage, support commitments, claims, and notice deadlines.",
        capabilities: [
          "Coverage and exclusions",
          "Asset and contract relationships",
          "Claims, outcomes, and reminders",
        ],
      },
    ],
  },
  {
    id: "service-lifecycle",
    title: "Service & lifecycle",
    pages: [
      {
        id: "maintenance-plans",
        title: "Maintenance plans",
        description:
          "Plan recurring maintenance for critical IT and communication equipment.",
        capabilities: [
          "Schedule and scope",
          "Assigned work and evidence",
          "Maintenance history",
        ],
      },
      {
        id: "repair-tickets",
        title: "Repair tickets",
        description:
          "Coordinate diagnosis, repair, verification, and closure while keeping asset condition separate from ticket status.",
        capabilities: [
          "Assignee, vendor, work notes, and parts",
          "Downtime intervals and supporting evidence",
          "Explicit repair transitions",
        ],
      },
      {
        id: "verification-campaigns",
        title: "Verification campaigns",
        description:
          "Plan scoped physical verification and review observations without silently changing authoritative records.",
        capabilities: [
          "Expected asset scope",
          "Scan or manual observations",
          "Discrepancy reconciliation",
        ],
      },
      {
        id: "offboarding",
        title: "Offboarding",
        description:
          "Coordinate recovery and follow-up across hardware, software, and communication resources.",
        capabilities: [
          "Hardware and accessory recovery",
          "License and service follow-up",
          "Unresolved exceptions",
        ],
        decisionNote:
          "Employee-to-login identity linking and external service confirmation must be resolved before workflow completion can be claimed.",
      },
      {
        id: "retirement-disposal",
        title: "Retirement & disposal",
        description:
          "Separate retirement requests, recovery, sanitization evidence, and completed disposal.",
        capabilities: [
          "Reason and impact review",
          "Recovery and sanitization evidence",
          "Disposal method and certificates",
        ],
      },
    ],
  },
  {
    id: "integrations-reporting",
    title: "Integrations & reporting",
    pages: [
      {
        id: "discovery-sources",
        title: "Discovery sources & sync runs",
        description:
          "Monitor approved connectors, synchronization attempts, source timestamps, and observation freshness.",
        capabilities: [
          "Connector and sync status",
          "Last attempt, success, and safe error details",
          "Source timestamps and observation freshness",
        ],
      },
      {
        id: "reconciliation",
        title: "Reconciliation",
        description:
          "Compare discovered and registered records, preserve source values, and review ambiguous matches.",
        capabilities: [
          "Side-by-side observations",
          "Field ownership and freshness",
          "Explicit merge or link review",
        ],
      },
      {
        id: "reports-exports",
        title: "Reports & exports",
        description:
          "Provide scoped operational reports with documented definitions and server-calculated results.",
        capabilities: [
          "Filters, date range, and refresh time",
          "Definitions and missing-data treatment",
          "Authorized export progress and outcome",
        ],
      },
      {
        id: "business-audit",
        title: "Business audit",
        description:
          "Provide scoped, read-only access to business evidence when the relevant audit capability is granted.",
        capabilities: [
          "Chronological evidence and source references",
          "Scoped filters and review",
          "Authorized evidence exports",
        ],
      },
      {
        id: "documents",
        title: "Documents",
        description:
          "Attach and retrieve evidence through authorized access tied to its parent record.",
        capabilities: [
          "Upload and processing status",
          "Validation and availability",
          "Authorized server-generated downloads",
        ],
      },
    ],
  },
  {
    id: "administration",
    title: "Administration",
    pages: [
      {
        id: "manufacturers-models",
        title: "Manufacturers & models",
        description:
          "Manage reusable manufacturer and model references for hardware records.",
        capabilities: [
          "Organization-scoped master records",
          "Active and inactive references",
          "Historical relationships",
        ],
      },
      {
        id: "departments-cost-centers",
        title: "Departments & cost centers",
        description:
          "Maintain organizational references used by approved asset and reporting workflows.",
        capabilities: [
          "Department and cost center references",
          "Active and inactive lifecycle",
          "Historical assignments",
        ],
      },
      {
        id: "employees",
        title: "Employees",
        description:
          "Maintain employee references separately from sign-in accounts.",
        capabilities: [
          "Employee identity distinct from user login",
          "Minimum identity data for assigned operations",
          "Historical custody references",
        ],
      },
      {
        id: "workflow-configuration",
        title: "Workflow & notification configuration",
        description:
          "Configure only approved workflow policies and in-app notification behavior.",
        capabilities: [
          "Approved event and notification rules",
          "Policy version and history",
          "Delivery status and failures",
        ],
        decisionNote:
          "Approval authority, thresholds, self-approval, delegation, and evidence rules require approval before activation.",
      },
    ],
  },
  {
    id: "self-service",
    title: "My workspace",
    pages: [
      {
        id: "my-equipment",
        title: "My equipment",
        description:
          "Give employees a scoped view of their own assigned equipment and acknowledgments.",
        capabilities: [
          "Current equipment and accessories",
          "Receipt acknowledgments",
          "Own request and return history",
        ],
        decisionNote:
          "Employee-to-login identity linking must be approved before records can be shown.",
      },
      {
        id: "my-software-services",
        title: "My software & services",
        description:
          "Show only software and communication services linked to the signed-in employee.",
        capabilities: [
          "Own software allocations",
          "Own service assignments",
          "Relevant renewal or service status",
        ],
        decisionNote:
          "Employee identity linking and communication-data visibility must be approved.",
      },
      {
        id: "new-request",
        title: "New request",
        description:
          "Create a request for equipment, software, accessories, or communication services.",
        capabilities: [
          "Purpose, quantity, date, and justification",
          "Request history",
          "Approved fulfillment status",
        ],
      },
      {
        id: "acknowledge-receipt",
        title: "Acknowledge receipt",
        description:
          "Record an employee acknowledgment against an eligible server-issued assignment.",
        capabilities: [
          "Assignment and item review",
          "Acknowledgment evidence",
          "Server-confirmed outcome",
        ],
      },
      {
        id: "report-problem",
        title: "Report a problem",
        description:
          "Report an issue with equipment or an assigned service for authorized follow-up.",
        capabilities: [
          "Issue description and related item",
          "Submission status",
          "Follow-up history",
        ],
      },
      {
        id: "request-return",
        title: "Request a return",
        description:
          "Request a return for assigned equipment without directly changing custody.",
        capabilities: [
          "Return request and reason",
          "Inspection and handover status",
          "Server-confirmed custody outcome",
        ],
      },
      {
        id: "my-request-history",
        title: "My request history",
        description:
          "Review the signed-in employee's own request and acknowledgment history.",
        capabilities: [
          "Request status and timeline",
          "Related approval outcome",
          "Outstanding employee actions",
        ],
      },
    ],
  },
];

export const modulePagesById = new Map(
  modulePageGroups.flatMap((group) =>
    group.pages.map(
      (page) => [page.id, { ...page, group: group.title }] as const,
    ),
  ),
);
