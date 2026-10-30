export type DemoTone = "positive" | "warning" | "critical" | "neutral" | "info";

export interface DemoMetric {
  label: string;
  value: string;
  note: string;
}

export interface DemoRecord {
  reference: string;
  cells: string[];
  status: string;
  tone: DemoTone;
}

export interface DemoPageData {
  metrics: DemoMetric[];
  columns: string[];
  rows: DemoRecord[];
  contextNote?: string;
}

type MetricInput = readonly [label: string, value: string, note: string];
type RecordInput =
  | readonly [
      reference: string,
      cells: readonly string[],
      status: string,
      tone: DemoTone,
    ]
  | readonly [
      reference: string,
      cells: readonly string[],
      additionalCell: string,
      status: string,
      tone: DemoTone,
    ];

function demoPage(
  metrics: readonly MetricInput[],
  columns: readonly string[],
  records: readonly RecordInput[],
  contextNote?: string,
): DemoPageData {
  return {
    metrics: metrics.map(([label, value, note]) => ({ label, value, note })),
    columns: [...columns],
    rows: records.map((record) => {
      if (record.length === 4) {
        const [reference, cells, status, tone] = record;
        return { reference, cells: [...cells], status, tone };
      }

      const [reference, cells, additionalCell, status, tone] = record;
      return {
        reference,
        cells: [...cells, additionalCell],
        status,
        tone,
      };
    }),
    contextNote,
  };
}

export const demoDataById = {
  "my-tasks-approvals": demoPage(
    [
      ["Open tasks", "05", "2 due today"],
      ["Awaiting review", "03", "Across 2 areas"],
      ["Needs evidence", "01", "No action taken"],
    ],
    ["Task", "Related item", "Due"],
    [
      [
        "TASK-2104",
        ["Return inspection", "Laptop NB-2048", "Today"],
        "Due today",
        "warning",
      ],
      [
        "TASK-2098",
        ["Review discrepancy", "Monitor MN-1132", "30 Oct"],
        "Open",
        "neutral",
      ],
      [
        "APR-0812",
        ["Software request", "REQ-0441", "31 Oct"],
        "Review required",
        "info",
      ],
    ],
    "Approval actions are illustrative only; approval authority and evidence rules remain subject to approval.",
  ),
  notifications: demoPage(
    [
      ["Recent notices", "12", "Illustrative last 7 days"],
      ["Unread", "04", "3 assigned to your queue"],
      ["Delivery issues", "01", "Requires review"],
    ],
    ["Notification", "Related item", "Received"],
    [
      [
        "NTF-7601",
        ["Warranty notice", "Laptop NB-2048", "Today, 09:14"],
        "Unread",
        "info",
      ],
      [
        "NTF-7598",
        ["Repair update", "Printer PR-0082", "Yesterday"],
        "Read",
        "neutral",
      ],
      [
        "NTF-7583",
        ["Connector warning", "Endpoint source", "27 Oct"],
        "Delivery failed",
        "critical",
      ],
    ],
  ),
  reservations: demoPage(
    [
      ["Active reservations", "18", "Example snapshot"],
      ["Due this week", "04", "Review before expiry"],
      ["Available pool", "36", "No forecast implied"],
    ],
    ["Equipment", "Reservation window", "Requested by"],
    [
      [
        "RSV-2064",
        ["ThinkPad T14", "Pune HQ · 28-30 Oct"],
        "Aarav Shah",
        "Confirmed",
        "positive",
      ],
      [
        "RSV-2061",
        ["USB-C dock", "Bengaluru Hub · 29 Oct"],
        "Tara Menon",
        "Awaiting review",
        "warning",
      ],
      [
        "RSV-2054",
        ["Conference camera", "Pune HQ · 31 Oct"],
        "Dev Kulkarni",
        "Scheduled",
        "info",
      ],
    ],
  ),
  "assignments-returns": demoPage(
    [
      ["Open assignments", "164", "Illustrative records"],
      ["Returns due", "12", "Next 7 days"],
      ["Awaiting inspection", "03", "Not yet available"],
    ],
    ["Employee", "Equipment", "Expected return"],
    [
      [
        "ASN-3408",
        ["Meera Iyer", "Laptop NB-2048", "Due 28 Oct"],
        "Return due",
        "warning",
      ],
      [
        "ASN-3391",
        ["Kiran Das", "Headset HS-0182", "Issued 12 Sep"],
        "Acknowledged",
        "positive",
      ],
      [
        "RET-0907",
        ["Nisha Rao", "Dock DK-0220", "Received 27 Oct"],
        "Inspection pending",
        "info",
      ],
    ],
  ),
  transfers: demoPage(
    [
      ["In transit", "02", "Example movements"],
      ["Discrepancies", "01", "Review required"],
      ["Received this week", "09", "Illustrative total"],
    ],
    ["Route", "Items"],
    [
      [
        "TRF-1180",
        ["Pune HQ to Bengaluru Hub", "Laptop NB-2071"],
        "Dispatch confirmed",
        "info",
      ],
      [
        "TRF-1176",
        ["Warehouse West to Pune HQ", "Monitor MN-1132"],
        "Receipt discrepancy",
        "warning",
      ],
      [
        "TRF-1174",
        ["Pune HQ to Lab 2", "Switch SW-0045"],
        "Received",
        "positive",
      ],
    ],
  ),
  "accessories-stock": demoPage(
    [
      ["Tracked items", "42", "Across 6 sample groups"],
      ["Low availability", "08", "Illustrative threshold"],
      ["Pending receipts", "03", "Not posted"],
    ],
    ["Item", "Tracking mode", "Available / location"],
    [
      [
        "STK-0084",
        ["USB-C power adapter", "Quantity tracked", "24 units · Pune Store"],
        "Available",
        "positive",
      ],
      [
        "STK-0051",
        [
          "Laptop battery pack",
          "Quantity tracked",
          "3 units · Bengaluru Store",
        ],
        "Low availability",
        "warning",
      ],
      [
        "ACC-0148",
        ["Portable SSD", "Individually tracked", "Assigned · IT Pool"],
        "Assigned",
        "info",
      ],
    ],
    "Sample balances are display fixtures only; real stock must be derived from posted server transactions.",
  ),
  labels: demoPage(
    [
      ["Label batches", "06", "Illustrative history"],
      ["Assets queued", "24", "No print job created"],
      ["Template", "Standard", "Example configuration"],
    ],
    ["Label set", "Identifier format", "Created"],
    [
      [
        "LBL-0142",
        ["Laptops · 12 labels", "Asset tag with protected lookup"],
        "28 Oct",
        "Printed",
        "positive",
      ],
      [
        "LBL-0138",
        ["Monitors · 8 labels", "Asset tag with protected lookup"],
        "24 Oct",
        "Printed",
        "positive",
      ],
      [
        "LBL-0131",
        ["Network · 4 labels", "Manual review required"],
        "21 Oct",
        "Review required",
        "warning",
      ],
    ],
    "The sample QR references do not resolve to real assets.",
  ),
  "asset-imports": demoPage(
    [
      ["Draft jobs", "02", "No file uploaded"],
      ["Rows to review", "07", "Example validation result"],
      ["Committed", "00", "No commit performed"],
    ],
    ["File", "Validation summary", "Last updated"],
    [
      [
        "IMP-0408",
        ["asset-register-demo.csv", "8 parsed · 2 warnings"],
        "28 Oct",
        "Preview only",
        "info",
      ],
      [
        "IMP-0402",
        ["peripherals-sample.csv", "12 parsed · 5 errors"],
        "25 Oct",
        "Needs correction",
        "warning",
      ],
      [
        "IMP-0397",
        ["retired-equipment-demo.csv", "6 parsed"],
        "20 Oct",
        "Not committed",
        "neutral",
      ],
    ],
    "No files were selected, uploaded, or processed.",
  ),
  "software-catalog": demoPage(
    [
      ["Catalog products", "126", "Illustrative count"],
      ["Mappings to review", "11", "Source names retained"],
      ["Inactive products", "08", "Historical references kept"],
    ],
    ["Product", "Publisher", "Edition"],
    [
      [
        "SW-0104",
        ["Office Suite", "Northwind Software", "Business"],
        "Active",
        "positive",
      ],
      [
        "SW-0088",
        ["Design Studio", "Canvas Works", "Professional"],
        "Mapping review",
        "warning",
      ],
      [
        "SW-0063",
        ["Database Engine", "Example Systems", "Standard"],
        "Inactive",
        "neutral",
      ],
    ],
  ),
  installations: demoPage(
    [
      ["Observations", "864", "Example snapshot"],
      ["Stale", "18", "No removal inferred"],
      ["Unknown", "04", "Needs review"],
    ],
    ["Product / version", "Device", "Source / last seen"],
    [
      [
        "OBS-5108",
        ["Office Suite 6.2", "Laptop NB-2048", "Endpoint feed · 28 Oct"],
        "Present",
        "positive",
      ],
      [
        "OBS-5092",
        ["Design Studio 4.1", "Workstation WS-0107", "Endpoint feed · 14 Oct"],
        "Stale",
        "warning",
      ],
      [
        "OBS-5087",
        ["Database Engine 15", "Server SV-0038", "Inventory import · unknown"],
        "Unknown",
        "neutral",
      ],
    ],
    "A missed observation is not treated as proof that software was removed.",
  ),
  entitlements: demoPage(
    [
      ["Active rights", "24", "Illustrative agreements"],
      ["Expiring in 90 days", "05", "Renewal dates shown separately"],
      ["Evidence missing", "02", "Requires review"],
    ],
    ["Product / metric", "Publisher", "Term"],
    [
      [
        "ENT-0420",
        ["Office Suite · named user", "Northwind Software"],
        "Annual · through 31 Dec 2026",
        "Active",
        "positive",
      ],
      [
        "ENT-0413",
        ["Design Studio · device", "Canvas Works"],
        "Annual · notice 15 Nov",
        "Notice due",
        "warning",
      ],
      [
        "ENT-0398",
        ["Database Engine · core", "Example Systems"],
        "Perpetual · evidence pending",
        "Needs evidence",
        "info",
      ],
    ],
    "License secrets and cost fields are intentionally omitted from the demo.",
  ),
  "license-allocations": demoPage(
    [
      ["Purchased units", "240", "Sample seat metric only"],
      ["Allocated units", "214", "Illustrative snapshot"],
      ["Unassigned units", "26", "Not a compliance finding"],
    ],
    ["Product", "Metric", "Target"],
    [
      [
        "ALC-5204",
        ["Office Suite", "Named user"],
        "Tara Menon",
        "Active",
        "positive",
      ],
      [
        "ALC-5198",
        ["Design Studio", "Device"],
        "Workstation WS-0107",
        "Review target",
        "warning",
      ],
      [
        "ALC-5181",
        ["Office Suite", "Named user"],
        "Meera Iyer",
        "Ends 31 Oct",
        "info",
      ],
    ],
  ),
  "subscriptions-renewals": demoPage(
    [
      ["Subscriptions", "32", "Example portfolio"],
      ["Renewals in 90 days", "06", "Calendar window"],
      ["Notice dates due", "02", "Separate from renewal"],
    ],
    ["Product", "Publisher", "Renewal / notice"],
    [
      [
        "SUB-0218",
        ["Office Suite · annual", "Northwind Software"],
        "Renewal 31 Dec · notice 30 Nov",
        "In term",
        "positive",
      ],
      [
        "SUB-0202",
        ["Design Studio · annual", "Canvas Works"],
        "Renewal 15 Jan · notice 15 Nov",
        "Notice due",
        "warning",
      ],
      [
        "SUB-0186",
        ["Team Chat · annual", "Example Systems"],
        "Renewal 20 Feb · notice 20 Jan",
        "In term",
        "neutral",
      ],
    ],
  ),
  "license-assessments": demoPage(
    [
      ["Evaluations", "18", "Illustrative only"],
      ["Needs review", "04", "Interpretation unresolved"],
      ["Evidence stale", "03", "Freshness matters"],
    ],
    ["Product", "Evidence / allocation", "Observation"],
    [
      [
        "ASM-0804",
        ["Office Suite", "Allocated 214 · measured usage unavailable"],
        "Evidence unavailable",
        "Unknown",
        "neutral",
      ],
      [
        "ASM-0798",
        ["Design Studio", "Entitlement document needs review"],
        "Last checked 14 Oct",
        "Needs review",
        "warning",
      ],
      [
        "ASM-0781",
        ["Database Engine", "Metric mapping not confirmed"],
        "Source data incomplete",
        "Needs review",
        "warning",
      ],
    ],
    "No green compliance result is shown when evidence or interpretation is missing.",
  ),
  "mobile-services": demoPage(
    [
      ["Service lines", "48", "Fictional sample"],
      ["Renewal review", "05", "Dates only"],
      ["Masked identifiers", "48", "Sensitive values hidden"],
    ],
    ["Service", "Assigned to", "Plan / renewal", "Masked number"],
    [
      [
        "MOB-0142",
        ["Mobile voice and data", "Tara Menon", "Business Flex · 31 Dec"],
        "+91 ••••• 0164",
        "Active",
        "positive",
      ],
      [
        "MOB-0138",
        ["Data-only SIM", "Field Tablet TB-0041", "Data Connect · 15 Nov"],
        "+91 ••••• 0288",
        "Review renewal",
        "warning",
      ],
      [
        "MOB-0129",
        ["Mobile voice and data", "Unassigned pool", "Business Flex · 20 Jan"],
        "Identifier masked",
        "Available",
        "info",
      ],
    ],
    "All identifiers are fictional and masked; provider actions are not performed.",
  ),
  "telephone-plans": demoPage(
    [
      ["Number records", "36", "Masked sample identifiers"],
      ["Plan reviews", "04", "Illustrative"],
      ["Provider changes", "02", "Confirmation pending"],
    ],
    ["Service", "Plan", "Assignment"],
    [
      [
        "TEL-0214",
        ["Desk line · +91 •••• 4410", "Voice Basic"],
        "Pune HQ · Reception",
        "Active",
        "positive",
      ],
      [
        "TEL-0208",
        ["Mobile · +91 •••• 1672", "Business Flex"],
        "Meera Iyer",
        "Provider confirmation pending",
        "warning",
      ],
      [
        "TEL-0199",
        ["Desk line · +91 •••• 8305", "Voice Basic"],
        "Bengaluru Hub · Meeting room",
        "Active",
        "neutral",
      ],
    ],
    "Sensitive communication identifiers are masked in this illustrative view.",
  ),
  "internet-circuits": demoPage(
    [
      ["Active circuits", "12", "Example sites"],
      ["Support reviews", "02", "Coverage dates"],
      ["Installations planned", "01", "Not a provider order"],
    ],
    ["Location / service", "Bandwidth", "Provider reference"],
    [
      [
        "CIR-0084",
        ["Pune HQ · WAN", "1 Gbps"],
        "SampleNet · CN-••184",
        "Active",
        "positive",
      ],
      [
        "CIR-0079",
        ["Bengaluru Hub · Internet", "500 Mbps"],
        "NorthLink · CN-••079",
        "Support review",
        "warning",
      ],
      [
        "CIR-0076",
        ["Warehouse West · Internet", "200 Mbps"],
        "SampleNet · CN-••076",
        "Active",
        "neutral",
      ],
    ],
  ),
  "service-assignments": demoPage(
    [
      ["Current links", "41", "User, device, or location"],
      ["Reassignment requests", "03", "No carrier action"],
      ["History entries", "18", "Illustrative"],
    ],
    ["Service", "Type / plan", "Target"],
    [
      [
        "SVC-0304",
        ["MOB-0142 · Business Flex", "Mobile voice and data"],
        "Tara Menon",
        "Current",
        "positive",
      ],
      [
        "SVC-0298",
        ["TEL-0208 · Voice Basic", "Telephone number"],
        "Meera Iyer",
        "Provider confirmation pending",
        "warning",
      ],
      [
        "SVC-0281",
        ["CIR-0084 · WAN", "Internet circuit"],
        "Pune HQ",
        "Current",
        "neutral",
      ],
    ],
    "Rows are fictional; no external provider changes are confirmed by this demo.",
  ),
  "communication-renewals": demoPage(
    [
      ["Service renewals", "07", "Illustrative window"],
      ["Notice reviews", "03", "Owner follow-up"],
      ["Charge imports", "02", "Summary status only"],
    ],
    ["Service", "Provider / plan", "Renewal"],
    [
      [
        "MOB-0142",
        ["SampleNet · Business Flex", "Mobile service"],
        "31 Dec 2026",
        "Review scheduled",
        "info",
      ],
      [
        "CIR-0079",
        ["NorthLink · Internet", "Bengaluru Hub"],
        "15 Nov 2026",
        "Notice due",
        "warning",
      ],
      [
        "TEL-0199",
        ["SampleNet · Voice Basic", "Pune HQ"],
        "20 Jan 2027",
        "In term",
        "positive",
      ],
    ],
    "Charge amounts and usage details are omitted; approval is required for those fields.",
  ),
  requests: demoPage(
    [
      ["Open requests", "28", "Illustrative queue"],
      ["Awaiting review", "09", "No approval performed"],
      ["Required this week", "04", "Requested dates"],
    ],
    ["Requested item", "Purpose / details", "Requested by"],
    [
      [
        "REQ-0441",
        ["Software · Design Studio", "1 named-user allocation"],
        "Tara Menon",
        "Awaiting review",
        "warning",
      ],
      [
        "REQ-0438",
        ["Laptop · standard build", "Required 04 Nov"],
        "Aarav Shah",
        "Submitted",
        "info",
      ],
      [
        "REQ-0432",
        ["USB-C adapters", "Quantity 6 · Pune HQ"],
        "Dev Kulkarni",
        "Needs details",
        "neutral",
      ],
    ],
  ),
  "purchase-records": demoPage(
    [
      ["Purchase records", "54", "Fictional references"],
      ["Receiving open", "06", "Partial receipts possible"],
      ["Cost fields", "Restricted", "Not displayed"],
    ],
    ["Vendor / reference", "Lines", "Cost visibility"],
    [
      [
        "PUR-2308",
        ["Northwind Supply · INV-DEMO-104", "Laptop peripherals"],
        "4 lines · 2 received",
        "Open receiving",
        "info",
      ],
      [
        "PUR-2291",
        ["Example Systems · INV-DEMO-098", "Network equipment"],
        "3 lines · complete",
        "Received",
        "positive",
      ],
      [
        "PUR-2276",
        ["Canvas Works · INV-DEMO-081", "Software subscription"],
        "1 line · evidence pending",
        "Review required",
        "warning",
      ],
    ],
    "No prices, currencies, or purchase-order authoring actions are shown.",
  ),
  receiving: demoPage(
    [
      ["Open receipts", "06", "Illustrative queue"],
      ["Accepted", "18", "Example line quantities"],
      ["Rejected", "02", "Inspection follow-up"],
    ],
    ["Purchase reference", "Inspection / evidence", "Quantity progress"],
    [
      [
        "RCV-0914",
        ["PUR-2308", "Laptops · serial capture pending"],
        "4 ordered · 2 accepted",
        "Partial",
        "warning",
      ],
      [
        "RCV-0908",
        ["PUR-2291", "Switches · inspection complete"],
        "3 ordered · 3 accepted",
        "Complete",
        "positive",
      ],
      [
        "RCV-0901",
        ["PUR-2276", "Subscription evidence"],
        "1 ordered · 0 accepted",
        "Review evidence",
        "info",
      ],
    ],
    "Quantities are illustrative and are not server-authoritative receiving totals.",
  ),
  vendors: demoPage(
    [
      ["Active vendors", "24", "Sample organization"],
      ["Coverage links", "18", "Historical references"],
      ["Review due", "03", "Illustrative reminders"],
    ],
    ["Vendor", "Service area", "Service scope"],
    [
      [
        "VEN-0104",
        ["Northwind Supply", "IT hardware"],
        "Pune and Bengaluru",
        "Active",
        "positive",
      ],
      [
        "VEN-0098",
        ["SampleNet Services", "Connectivity"],
        "Network circuits",
        "Review due",
        "warning",
      ],
      [
        "VEN-0086",
        ["Canvas Works", "Software publisher"],
        "Software catalog",
        "Active",
        "neutral",
      ],
    ],
  ),
  "warranties-contracts": demoPage(
    [
      ["Coverage records", "38", "Illustrative links"],
      ["Expiring in 90 days", "05", "Date review"],
      ["Open claims", "02", "Vendor outcome pending"],
    ],
    ["Asset", "Coverage contract", "End date"],
    [
      [
        "COV-0184",
        ["Laptop NB-2048", "Northwind Care · Standard"],
        "31 Dec 2026",
        "Active",
        "positive",
      ],
      [
        "COV-0179",
        ["Switch SW-0045", "SampleNet Support"],
        "15 Nov 2026",
        "Renewal review",
        "warning",
      ],
      [
        "CLM-0028",
        ["Printer PR-0082", "Canvas Works · Repair claim"],
        "Outcome due 30 Oct",
        "Open claim",
        "info",
      ],
    ],
    "Contract terms and cost details are not included in this demo.",
  ),
  "maintenance-plans": demoPage(
    [
      ["Active plans", "14", "Illustrative schedule"],
      ["Work due this month", "08", "Planned tasks"],
      ["Overdue reviews", "02", "Needs attention"],
    ],
    ["Maintenance task", "Location / scope", "Next service"],
    [
      [
        "MPL-0084",
        ["UPS inspection", "Pune HQ · 4 units"],
        "04 Nov 2026",
        "Scheduled",
        "info",
      ],
      [
        "MPL-0079",
        ["Network room checks", "Bengaluru Hub"],
        "27 Oct 2026",
        "Overdue",
        "warning",
      ],
      [
        "MPL-0072",
        ["Printer cleaning", "Warehouse West"],
        "10 Nov 2026",
        "Scheduled",
        "positive",
      ],
    ],
  ),
  "repair-tickets": demoPage(
    [
      ["Open tickets", "11", "Illustrative queue"],
      ["Waiting on parts", "03", "Separate from asset state"],
      ["Downtime reviews", "02", "Interval based"],
    ],
    ["Equipment", "Reported work", "Assigned technician"],
    [
      [
        "REP-1832",
        ["Printer PR-0082", "Paper feed issue"],
        "Kiran Das",
        "Waiting for part",
        "warning",
      ],
      [
        "REP-1826",
        ["Laptop NB-2071", "Battery inspection"],
        "Sahana Rao",
        "Diagnosis",
        "info",
      ],
      [
        "REP-1819",
        ["Switch SW-0045", "Port check"],
        "Dev Kulkarni",
        "Verified",
        "positive",
      ],
    ],
    "Ticket status is distinct from equipment lifecycle, condition, and availability.",
  ),
  "verification-campaigns": demoPage(
    [
      ["Campaigns", "03", "Illustrative scopes"],
      ["Observations", "124", "Not reconciled"],
      ["Discrepancies", "07", "Require review"],
    ],
    ["Scope", "Snapshot", "Progress"],
    [
      [
        "VER-0208",
        ["Pune HQ · laptops", "Asset snapshot 24 Oct"],
        "42 of 48 observed",
        "In progress",
        "info",
      ],
      [
        "VER-0202",
        ["Bengaluru Hub · network", "Asset snapshot 22 Oct"],
        "18 of 18 observed",
        "Reconciliation review",
        "warning",
      ],
      [
        "VER-0196",
        ["Warehouse West · peripherals", "Asset snapshot 18 Oct"],
        "31 of 31 observed",
        "Complete",
        "positive",
      ],
    ],
    "Observations do not silently update confirmed location or custody.",
  ),
  offboarding: demoPage(
    [
      ["Open checklists", "04", "Fictional cases"],
      ["Recovery items", "07", "Hardware and accessories"],
      ["External confirmations", "02", "Still outstanding"],
    ],
    ["Employee", "Context", "Outstanding items"],
    [
      [
        "OFF-0108",
        ["Tara Menon", "Sample employee"],
        "Laptop NB-2048 · return inspection",
        "In progress",
        "warning",
      ],
      [
        "OFF-0104",
        ["Aarav Shah", "Sample employee"],
        "SaaS removal confirmation",
        "External confirmation pending",
        "info",
      ],
      [
        "OFF-0098",
        ["Nisha Rao", "Sample employee"],
        "SIM reassignment · MOB-0129",
        "Review required",
        "neutral",
      ],
    ],
    "A local deallocation is not represented as confirmed external account removal.",
  ),
  "retirement-disposal": demoPage(
    [
      ["Retirement reviews", "05", "Illustrative queue"],
      ["Awaiting recovery", "02", "Before disposal"],
      ["Evidence incomplete", "01", "Not complete"],
    ],
    ["Equipment", "Reason", "Next requirement"],
    [
      [
        "DSP-0312",
        ["Laptop NB-1884", "End-of-life review"],
        "Sanitization evidence",
        "Pending",
        "warning",
      ],
      [
        "DSP-0308",
        ["Printer PR-0061", "Replacement approved"],
        "Vendor return receipt",
        "Awaiting receipt",
        "info",
      ],
      [
        "DSP-0301",
        ["Monitor MN-0920", "Retirement requested"],
        "Recovery check",
        "Review required",
        "neutral",
      ],
    ],
    "Retirement and completed disposal are represented as separate stages.",
  ),
  "discovery-sources": demoPage(
    [
      ["Connectors", "04", "Illustrative sources"],
      ["Last sync warnings", "02", "Safe summaries only"],
      ["Stale observations", "18", "Freshness review"],
    ],
    ["Source", "Last attempt", "Last success"],
    [
      [
        "SRC-0104",
        ["Endpoint inventory sample", "28 Oct 2026 · 09:10"],
        "28 Oct 2026 · 09:11",
        "Healthy",
        "positive",
      ],
      [
        "SRC-0098",
        ["Directory feed sample", "28 Oct 2026 · 08:40"],
        "27 Oct 2026 · 08:42",
        "Warning",
        "warning",
      ],
      [
        "SRC-0081",
        ["Mobile device sample", "28 Oct 2026 · 08:00"],
        "26 Oct 2026 · 08:01",
        "Sync failed",
        "critical",
      ],
    ],
    "Connector names and timestamps are fictional; no external source is queried.",
  ),
  reconciliation: demoPage(
    [
      ["Needs review", "07", "Illustrative exceptions"],
      ["Ambiguous matches", "02", "No auto-link"],
      ["Field conflicts", "04", "Owner review"],
    ],
    ["Registered value", "Registered location", "Discovered value"],
    [
      [
        "REC-4408",
        ["Laptop NB-2048 · serial ending 417", "Pune HQ"],
        "Laptop · serial ending 417 · Pune HQ",
        "Possible match",
        "warning",
      ],
      [
        "REC-4402",
        ["Workstation WS-0107 · model A", "Assigned"],
        "Workstation · model B · last seen 27 Oct",
        "Field conflict",
        "critical",
      ],
      [
        "REC-4398",
        ["No registered asset", "Unknown location"],
        "Device DVC-8831 · serial unavailable",
        "Unmatched",
        "info",
      ],
    ],
    "Discovered values are observations, not authoritative updates.",
  ),
  "reports-exports": demoPage(
    [
      ["Saved reports", "08", "Fictional examples"],
      ["Exports running", "01", "Demo status only"],
      ["Last refresh", "28 Oct", "09:00 sample time"],
    ],
    ["Report", "Scope / definition", "Last refresh"],
    [
      [
        "RPT-0108",
        ["Assets by location", "Active individually tracked assets"],
        "28 Oct 2026 · 09:00",
        "Ready",
        "positive",
      ],
      [
        "RPT-0104",
        ["Warranty review", "Coverage end date in 90 days"],
        "28 Oct 2026 · 09:00",
        "Ready",
        "info",
      ],
      [
        "EXP-0081",
        ["Verification exceptions", "Pune HQ · current campaign"],
        "Started 09:12",
        "Preparing",
        "warning",
      ],
    ],
    "Metrics and export states are illustrative, not calculated or downloaded.",
  ),
  "business-audit": demoPage(
    [
      ["Example events", "24", "Read-only illustration"],
      ["Review flags", "02", "Context required"],
      ["Exports", "00", "No file generated"],
    ],
    ["Event", "Record", "Actor / time"],
    [
      [
        "AUD-8704",
        ["Profile description updated", "Asset NB-2048"],
        "Sample Asset Manager · 28 Oct",
        "Example",
        "neutral",
      ],
      [
        "AUD-8701",
        ["Receipt observation recorded", "Receipt RCV-0914"],
        "Sample Procurement User · 28 Oct",
        "Example",
        "neutral",
      ],
      [
        "AUD-8698",
        ["Role assignment changed", "User DEMO-104"],
        "Sample Administrator · 27 Oct",
        "Review context",
        "info",
      ],
    ],
    "This screen is not a claim of immutable or production audit evidence.",
  ),
  documents: demoPage(
    [
      ["Example attachments", "18", "Metadata only"],
      ["Processing", "02", "Illustrative queue"],
      ["Failed validation", "01", "Review required"],
    ],
    ["Document", "Parent record", "Added"],
    [
      [
        "DOC-0208",
        ["warranty-summary-demo.pdf", "Coverage COV-0184"],
        "28 Oct 2026",
        "Available",
        "positive",
      ],
      [
        "DOC-0204",
        ["inspection-note-demo.pdf", "Repair REP-1832"],
        "28 Oct 2026",
        "Processing",
        "info",
      ],
      [
        "DOC-0198",
        ["receipt-evidence-demo.pdf", "Receipt RCV-0901"],
        "27 Oct 2026",
        "Validation failed",
        "critical",
      ],
    ],
    "No file content is stored or downloadable from this demo.",
  ),
  "manufacturers-models": demoPage(
    [
      ["Manufacturers", "32", "Illustrative master data"],
      ["Models", "184", "Historical links retained"],
      ["Inactive references", "06", "Not deleted"],
    ],
    ["Manufacturer / model", "Category"],
    [
      [
        "MFR-0108",
        ["Northwind Devices · ThinkPad T14", "Laptop"],
        "Active",
        "positive",
      ],
      [
        "MFR-0102",
        ["Canvas Works · Display 24", "Monitor"],
        "Active",
        "positive",
      ],
      [
        "MFR-0091",
        ["Example Systems · EdgeSwitch 48", "Network"],
        "Inactive reference",
        "neutral",
      ],
    ],
  ),
  "departments-cost-centers": demoPage(
    [
      ["Departments", "12", "Sample organization"],
      ["Cost centers", "18", "Identifiers kept as strings"],
      ["Inactive references", "02", "Historical use retained"],
    ],
    ["Cost center", "Location"],
    [
      ["IT Operations", ["00418", "Pune HQ"], "Active", "positive"],
      ["Business Systems", ["00106", "Bengaluru Hub"], "Active", "positive"],
      [
        "Field Services",
        ["00027", "Regional"],
        "Inactive reference",
        "neutral",
      ],
    ],
  ),
  employees: demoPage(
    [
      ["Employee references", "286", "Separate from login accounts"],
      ["Active assignments", "164", "Illustrative links"],
      ["Identity review", "03", "Scope limited"],
    ],
    ["Employee", "Department", "Login link"],
    [
      [
        "EMP-DEMO-104",
        ["Tara Menon", "IT Operations"],
        "No login required",
        "Active",
        "positive",
      ],
      [
        "EMP-DEMO-098",
        ["Aarav Shah", "Business Systems"],
        "User link verified in sample",
        "Active",
        "info",
      ],
      [
        "EMP-DEMO-081",
        ["Nisha Rao", "Field Services"],
        "Identity link pending",
        "Review",
        "warning",
      ],
    ],
    "All employee profiles shown here are fictional examples.",
  ),
  "workflow-configuration": demoPage(
    [
      ["Example policies", "06", "Not active configuration"],
      ["Pending decisions", "04", "Authority and evidence"],
      ["Notification rules", "08", "Illustrative"],
    ],
    ["Policy", "Applies to", "Version"],
    [
      [
        "POL-DEMO-018",
        ["Return inspection reminder", "Asset return"],
        "Example 1.2",
        "Draft",
        "info",
      ],
      [
        "POL-DEMO-014",
        ["Renewal notice", "Software subscription"],
        "Example 1.0",
        "Review required",
        "warning",
      ],
      [
        "POL-DEMO-008",
        ["Approval threshold", "Purchase request"],
        "Not configured",
        "Decision required",
        "critical",
      ],
    ],
    "No approval policy or notification rule is activated by this route.",
  ),
  "my-equipment": demoPage(
    [
      ["Assigned items", "03", "Sample employee only"],
      ["Acknowledgments", "02", "Illustrative"],
      ["Return follow-ups", "01", "No action performed"],
    ],
    ["Equipment", "Location", "Issued"],
    [
      [
        "ASN-DEMO-408",
        ["Laptop NB-2048 · Good", "Pune HQ"],
        "02 Jun 2026",
        "Acknowledged",
        "positive",
      ],
      [
        "ASN-DEMO-391",
        ["Dock DK-0220 · Good", "Pune HQ"],
        "02 Jun 2026",
        "Acknowledged",
        "positive",
      ],
      [
        "ASN-DEMO-372",
        ["Headset HS-0182 · Fair", "Pune HQ"],
        "18 Mar 2026",
        "Return requested",
        "warning",
      ],
    ],
    "Sample employee: Tara Menon. This is not the signed-in user's equipment.",
  ),
  "my-software-services": demoPage(
    [
      ["Software allocations", "04", "Sample employee only"],
      ["Service links", "02", "Masked identifiers"],
      ["Renewals to review", "01", "Illustrative"],
    ],
    ["Product / metric", "Publisher / service", "Renewal"],
    [
      [
        "ALC-DEMO-204",
        ["Office Suite · named user", "Northwind Software"],
        "31 Dec 2026",
        "Active",
        "positive",
      ],
      [
        "ALC-DEMO-198",
        ["Design Studio · named user", "Canvas Works"],
        "15 Nov 2026",
        "Notice review",
        "warning",
      ],
      [
        "SVC-DEMO-172",
        ["Mobile service · +91 •••• 0164", "Business Flex"],
        "31 Dec 2026",
        "Active",
        "neutral",
      ],
    ],
    "Sample employee: Tara Menon. Communication identifiers remain masked.",
  ),
  "new-request": demoPage(
    [
      ["Draft examples", "02", "No request created"],
      ["Submitted examples", "03", "Illustrative history"],
      ["Needs information", "01", "Sample status"],
    ],
    ["Requested item", "Purpose", "Required date"],
    [
      [
        "REQ-DEMO-441",
        ["Laptop · replacement", "Battery life issue"],
        "04 Nov 2026",
        "Draft example",
        "neutral",
      ],
      [
        "REQ-DEMO-438",
        ["Software · Design Studio", "Project design work"],
        "10 Nov 2026",
        "Submitted example",
        "info",
      ],
      [
        "REQ-DEMO-432",
        ["Accessories · USB-C adapter", "Field kit"],
        "31 Oct 2026",
        "Needs details",
        "warning",
      ],
    ],
    "Demo requests are examples only; submitting is not available here.",
  ),
  "acknowledge-receipt": demoPage(
    [
      ["Awaiting acknowledgment", "02", "Illustrative assignments"],
      ["Acknowledged examples", "08", "No action performed"],
      ["Inspection follow-up", "01", "Separate process"],
    ],
    ["Item", "Condition / accessories", "Issued by"],
    [
      [
        "ASN-DEMO-408",
        ["Laptop NB-2048", "Good · charger included"],
        "Sample Asset Manager · 28 Oct",
        "Awaiting acknowledgment",
        "warning",
      ],
      [
        "ASN-DEMO-402",
        ["Monitor MN-1132", "New · stand included"],
        "Sample Asset Manager · 27 Oct",
        "Awaiting acknowledgment",
        "info",
      ],
      [
        "ASN-DEMO-391",
        ["Dock DK-0220", "Good · power supply included"],
        "Sample Asset Manager · 02 Jun",
        "Acknowledged",
        "positive",
      ],
    ],
    "This view does not acknowledge or modify any assignment.",
  ),
  "report-problem": demoPage(
    [
      ["Example issues", "06", "Fictional records"],
      ["Open", "03", "No ticket created"],
      ["Follow-up due", "01", "Illustrative"],
    ],
    ["Related item", "Issue description", "Reported"],
    [
      [
        "ISS-DEMO-208",
        ["Laptop NB-2048", "Battery drains quickly"],
        "28 Oct 2026",
        "Open example",
        "info",
      ],
      [
        "ISS-DEMO-204",
        ["Headset HS-0182", "Intermittent microphone"],
        "26 Oct 2026",
        "Technician review",
        "warning",
      ],
      [
        "ISS-DEMO-198",
        ["Mobile service MOB-0142", "Coverage question"],
        "24 Oct 2026",
        "Follow-up due",
        "neutral",
      ],
    ],
    "Issue descriptions and reporter identities are fictional.",
  ),
  "request-return": demoPage(
    [
      ["Return examples", "04", "No return initiated"],
      ["Awaiting inspection", "02", "Sample records"],
      ["Items to recover", "03", "Example count"],
    ],
    ["Equipment", "Condition / detail", "Requested by"],
    [
      [
        "RET-DEMO-907",
        ["Headset HS-0182", "Condition noted: Fair"],
        "Tara Menon",
        "Review requested",
        "warning",
      ],
      [
        "RET-DEMO-902",
        ["Laptop NB-1904", "Accessories listed: 3"],
        "Aarav Shah",
        "Scheduled example",
        "info",
      ],
      [
        "RET-DEMO-894",
        ["Dock DK-0198", "Inspection required"],
        "Nisha Rao",
        "Awaiting inspection",
        "neutral",
      ],
    ],
    "A return request does not directly close custody or make an asset available.",
  ),
  "my-request-history": demoPage(
    [
      ["Requests", "08", "Sample employee history"],
      ["In progress", "02", "Illustrative"],
      ["Employee action due", "01", "No task completed"],
    ],
    ["Request type", "Item", "Last update"],
    [
      [
        "REQ-DEMO-441",
        ["Equipment replacement", "Laptop"],
        "28 Oct 2026",
        "Draft example",
        "neutral",
      ],
      [
        "REQ-DEMO-438",
        ["Software allocation", "Design Studio"],
        "27 Oct 2026",
        "In review",
        "info",
      ],
      [
        "REQ-DEMO-432",
        ["Accessory request", "USB-C adapter"],
        "25 Oct 2026",
        "More information needed",
        "warning",
      ],
    ],
    "Sample employee: Tara Menon. These examples are not linked to an account.",
  ),
} satisfies Record<string, DemoPageData>;
