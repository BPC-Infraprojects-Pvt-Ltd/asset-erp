import { Link, Navigate, useParams, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { demoDataById, type DemoPageData, type DemoRecord } from "./demo-data";
import {
  demoDetailProfilesById,
  type DemoDetailLayout,
  type DemoDetailProfile,
} from "./demo-detail-profiles";
import { demoFormProfilesById } from "./demo-form-profiles";
import { DemoFormPreview } from "./demo-form";
import { modulePagesById } from "./module-pages";
import { DepartmentsCostCentersPage } from "../master-data/departments-cost-centers-page";
import { ManufacturersModelsPage } from "../master-data/manufacturers-models-page";
import { EmployeesPage } from "../master-data/employees-page";
import { AssetLabelsPage } from "../assets/asset-labels-page";
import { AssetReservationsPage } from "../assets/asset-reservations-page";
import { AssetAssignmentsPage } from "../assets/asset-assignments-page";
import { AssetTransfersPage } from "../assets/asset-transfers-page";
import { AccessoriesStockPage } from "../stock/stock-page";
import { AssetImportsPage } from "../imports/asset-imports-page";

const demoDataByPageId = new Map(Object.entries(demoDataById));
const demoDetailProfilesByPageId = new Map(
  Object.entries(demoDetailProfilesById),
);
const demoFormProfilesByPageId = new Map(Object.entries(demoFormProfilesById));
type ModulePageDefinition = NonNullable<ReturnType<typeof modulePagesById.get>>;

export function ModuleRoutePage() {
  const { moduleId } = useParams({ from: "/modules/$moduleId" });
  const { demo, form, record } = useSearch({ from: "/modules/$moduleId" });
  if (demo !== true) {
    if (moduleId === "verification-campaigns") {
      return <Navigate to="/verification-campaigns" replace />;
    }
    if (moduleId === "retirement-disposal") {
      return <Navigate to="/retirements" search={{}} replace />;
    }
    if (moduleId === "departments-cost-centers") {
      return <DepartmentsCostCentersPage />;
    }
    if (moduleId === "manufacturers-models") {
      return <ManufacturersModelsPage />;
    }
    if (moduleId === "employees") {
      return <EmployeesPage />;
    }
    if (moduleId === "labels") {
      return <AssetLabelsPage />;
    }
    if (moduleId === "reservations") {
      return <AssetReservationsPage />;
    }
    if (moduleId === "assignments-returns") {
      return <AssetAssignmentsPage />;
    }
    if (moduleId === "transfers") {
      return <AssetTransfersPage />;
    }
    if (moduleId === "accessories-stock") {
      return <AccessoriesStockPage />;
    }
    if (moduleId === "asset-imports") {
      return <AssetImportsPage />;
    }
  }

  return (
    <ModulePage
      key={`${moduleId}:${demo ? "demo" : "preview"}:${record ?? ""}:${form ?? ""}`}
      pageId={moduleId}
      recordId={record}
      showSampleData={demo === true}
      showForm={form === true}
    />
  );
}

interface ModulePageProps {
  pageId: string;
  recordId?: string;
  showForm: boolean;
  showSampleData: boolean;
}

export function ModulePage({
  pageId,
  recordId,
  showForm,
  showSampleData,
}: ModulePageProps) {
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");
  const page = modulePagesById.get(pageId);
  const data = demoDataByPageId.get(pageId);
  const detailProfile = demoDetailProfilesByPageId.get(pageId);
  const formProfile = demoFormProfilesByPageId.get(pageId);
  const selectedRecord = data?.rows.find((row) => row.reference === recordId);
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const filteredRows = useMemo(() => {
    if (!data || !normalizedFilter) return data?.rows ?? [];
    return data.rows.filter((row) =>
      [row.reference, ...row.cells, row.status]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedFilter),
    );
  }, [data, normalizedFilter]);

  if (!page) {
    return (
      <section>
        <div className="page-heading">
          <p className="eyebrow">Workspace</p>
          <h1>Page not found</h1>
          <p className="page-description">
            This workspace page is not available.
          </p>
        </div>
        <Link className="button button-secondary" to="/">
          Return to overview
        </Link>
      </section>
    );
  }

  if (!data || !detailProfile || !formProfile) {
    return (
      <p className="form-error" role="alert">
        Sample details or forms are not configured for this page.
      </p>
    );
  }

  if (!showSampleData) {
    return (
      <section className="module-page">
        <div className="page-heading">
          <p className="eyebrow">{page.group}</p>
          <div className="module-title-row">
            <div>
              <h1>{page.title}</h1>
              <p className="page-description">{page.description}</p>
            </div>
            <span className="module-preview-badge">Frontend preview</span>
          </div>
        </div>

        <section className="module-connection-card" role="status">
          <span className="module-connection-mark" aria-hidden="true">
            UI
          </span>
          <div>
            <p className="eyebrow">API integration pending</p>
            <h2>This module is not connected to live records</h2>
            <p>
              Explore its layout with fictional, read-only records. No business
              API is called and no organization data is changed.
            </p>
          </div>
        </section>

        <section
          className="module-capabilities"
          aria-labelledby="planned-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">Product scope</p>
              <h2 id="planned-title">Planned capabilities</h2>
            </div>
            <span className="module-scope-label">
              Illustrative view available
            </span>
          </div>
          <ul className="capability-list">
            {page.capabilities.map((capability) => (
              <li key={capability}>
                <span className="capability-marker" aria-hidden="true" />
                {capability}
              </li>
            ))}
          </ul>
        </section>

        {page.decisionNote && (
          <aside className="module-decision-note">
            <strong>Policy decision required</strong>
            <p>{page.decisionNote}</p>
          </aside>
        )}

        <Link
          className="button button-secondary"
          params={{ moduleId: page.id }}
          search={{ demo: true }}
          to="/modules/$moduleId"
        >
          View illustrative data
        </Link>
      </section>
    );
  }

  if (showForm) {
    if (!formProfile) {
      return (
        <p className="form-error" role="alert">
          A form preview is not configured for this feature.
        </p>
      );
    }

    return <DemoFormPreview page={page} profile={formProfile} />;
  }

  if (recordId) {
    if (!selectedRecord) {
      return (
        <section>
          <p className="form-error" role="alert">
            This sample record is not available in the selected page.
          </p>
          <Link
            className="button button-secondary"
            params={{ moduleId: page.id }}
            search={{ demo: true }}
            to="/modules/$moduleId"
          >
            Back to {page.title}
          </Link>
        </section>
      );
    }

    return (
      <ModuleRecordDetail
        activeTab={activeTab}
        data={data}
        detailProfile={detailProfile}
        onTabChange={setActiveTab}
        page={page}
        record={selectedRecord}
      />
    );
  }

  return (
    <section className="demo-page">
      <div className="demo-breadcrumb">
        <span>Workspace preview</span>
        <span aria-hidden="true">/</span>
        <span>{page.group}</span>
      </div>

      <div className="demo-page-heading">
        <div>
          <p className="eyebrow">{page.group}</p>
          <h1>{page.title}</h1>
          <p className="page-description">{page.description}</p>
        </div>
        <div className="demo-page-tags">
          <span className="demo-only-badge">Illustrative data</span>
          <span className="demo-readonly-badge">Read only</span>
          <Link
            className="button button-secondary"
            params={{ moduleId: page.id }}
            search={{ demo: true, form: true }}
            to="/modules/$moduleId"
          >
            Preview feature form
          </Link>
        </div>
      </div>

      <aside className="demo-data-banner" role="note">
        <span className="demo-banner-mark" aria-hidden="true">
          DEMO
        </span>
        <div>
          <strong>Illustrative snapshot · 28 Oct 2026</strong>
          <p>
            This page uses fictional local data on the explicit demo preview
            route. No business API is called and no live record is read or
            changed.
          </p>
        </div>
      </aside>

      {page.decisionNote && (
        <aside className="module-decision-note">
          <strong>Policy decision required</strong>
          <p>{page.decisionNote}</p>
        </aside>
      )}

      <div className="demo-metric-grid">
        {data.metrics.map((metric) => (
          <article className="demo-metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </div>

      <section
        className="demo-records-card"
        aria-labelledby="demo-records-title"
      >
        <div className="demo-records-heading">
          <div>
            <p className="eyebrow">Sample records</p>
            <h2 id="demo-records-title">Example {page.title.toLowerCase()}</h2>
            <p>
              A read-only view of {data.rows.length} fictional records from the
              sample snapshot.
            </p>
          </div>
          <label className="demo-filter">
            <span>Filter examples</span>
            <input
              autoComplete="off"
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search reference or detail"
              type="search"
              value={filter}
            />
          </label>
        </div>

        <div className="demo-table-scroll">
          <table className="demo-table">
            <caption className="sr-only">
              Fictional {page.title.toLowerCase()} sample records. This data is
              not live.
            </caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                {data.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
                <th scope="col">Example status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.reference}>
                  <td className="demo-reference">
                    <Link
                      params={{ moduleId: page.id }}
                      search={{ demo: true, record: row.reference }}
                      to="/modules/$moduleId"
                    >
                      {row.reference}
                    </Link>
                  </td>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.reference}-${index}`}>{cell}</td>
                  ))}
                  <td>
                    <span className={`demo-status demo-status-${row.tone}`}>
                      <span aria-hidden="true" />
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRows.length && (
            <p className="demo-empty-state" role="status">
              No example records match “{filter}”.
            </p>
          )}
        </div>

        <div className="demo-records-footer" aria-live="polite">
          <span>
            Showing {filteredRows.length} of {data.rows.length} example records
          </span>
          <span>
            Status legend: positive, informational, review, or failed sample
            state
          </span>
        </div>
      </section>

      {data.contextNote && (
        <p className="demo-context-note">{data.contextNote}</p>
      )}

      <div className="demo-page-footer">
        <Link
          className="module-back-link"
          params={{ moduleId: page.id }}
          search={{}}
          to="/modules/$moduleId"
        >
          Return to page overview
        </Link>
        <Link className="module-back-link" to="/">
          Back to workspace overview
        </Link>
      </div>
    </section>
  );
}

interface ModuleRecordDetailProps {
  activeTab: string;
  data: DemoPageData;
  detailProfile: DemoDetailProfile;
  onTabChange: (tab: string) => void;
  page: ModulePageDefinition;
  record: DemoRecord;
}

const detailLayoutNotes: Record<
  DemoDetailLayout,
  { title: string; note: string }
> = {
  asset: {
    title: "Equipment context",
    note: "Lifecycle, availability, condition, and verification remain separate dimensions.",
  },
  workflow: {
    title: "Current sample stage",
    note: "The displayed status is illustrative; no transition or approval was performed.",
  },
  catalog: {
    title: "Catalog and entitlement context",
    note: "Product rights, licensing metrics, and evidence are separate concepts.",
  },
  comparison: {
    title: "Source comparison",
    note: "Observed values are shown for review and are not authoritative updates.",
  },
  communication: {
    title: "Service context",
    note: "Identifiers are masked and no carrier outcome is being confirmed.",
  },
  procurement: {
    title: "Procurement context",
    note: "Cost values and purchase authority are intentionally not represented.",
  },
  service: {
    title: "Coverage and work context",
    note: "Ticket status and equipment operational state are distinct.",
  },
  master: {
    title: "Organization reference",
    note: "Historical references remain visible; this preview does not edit master data.",
  },
  report: {
    title: "Report and evidence context",
    note: "Metrics and file availability are illustrative, not calculated or downloaded.",
  },
  "self-service": {
    title: "Sample employee scope",
    note: "The sample employee is fictional and is not the signed-in user.",
  },
};

function DetailLayoutNote({
  layout,
  summary,
}: {
  layout: DemoDetailLayout;
  summary: string;
}) {
  const content = detailLayoutNotes[layout];

  return (
    <aside className={`record-detail-context record-detail-context-${layout}`}>
      <div>
        <p className="eyebrow">{content.title}</p>
        <strong>{summary}</strong>
      </div>
      <p>{content.note}</p>
    </aside>
  );
}

function ModuleRecordDetail({
  activeTab,
  data,
  detailProfile,
  onTabChange,
  page,
  record,
}: ModuleRecordDetailProps) {
  const tabs = [
    detailProfile.overviewTab,
    detailProfile.detailTab,
    detailProfile.activityTab,
  ];
  const owner =
    detailProfile.ownerColumn === null
      ? "Not listed in this example"
      : (record.cells[detailProfile.ownerColumn] ??
        "Not listed in this example");
  const relatedFields = detailProfile.relatedColumns
    .map((index) => ({
      label: data.columns[index],
      value: record.cells[index],
    }))
    .filter((field) => field.label && field.value);
  const getFields = (columns: number[]) => [
    { label: "Reference", value: record.reference },
    ...columns.map((index) => ({
      label: data.columns[index],
      value: record.cells[index] ?? "Not specified in example",
    })),
    { label: "Example status", value: record.status },
  ];
  const overviewFields = getFields(detailProfile.overviewColumns);
  const detailFields = getFields(detailProfile.detailColumns);
  const isActivityTab = activeTab === detailProfile.activityTab;
  const visibleFields =
    activeTab === detailProfile.overviewTab ? overviewFields : detailFields;
  const relatedItems = relatedFields.length
    ? relatedFields
    : [{ label: "Reference", value: record.reference }];
  const recordTitle =
    record.cells[detailProfile.overviewColumns[0] ?? 0] || record.reference;

  return (
    <section
      className={`record-detail-page record-detail-${detailProfile.layout}`}
    >
      <nav className="record-breadcrumbs" aria-label="Breadcrumb">
        <Link
          params={{ moduleId: page.id }}
          search={{ demo: true }}
          to="/modules/$moduleId"
        >
          {page.group}
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          params={{ moduleId: page.id }}
          search={{ demo: true }}
          to="/modules/$moduleId"
        >
          {page.title}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{record.reference}</span>
      </nav>

      <header className="record-detail-header">
        <div>
          <p className="eyebrow">{detailProfile.entityType}</p>
          <div className="record-title-line">
            <h1>{recordTitle}</h1>
            <span className={`demo-status demo-status-${record.tone}`}>
              <span aria-hidden="true" />
              {record.status}
            </span>
          </div>
          <p className="page-description">
            {detailProfile.summary} · {record.reference}
          </p>
        </div>
        <div className="record-detail-header-actions">
          <Link
            className="button button-secondary"
            params={{ moduleId: page.id }}
            search={{ demo: true, form: true }}
            to="/modules/$moduleId"
          >
            Preview related form
          </Link>
          <Link
            className="button button-secondary"
            params={{ moduleId: page.id }}
            search={{ demo: true }}
            to="/modules/$moduleId"
          >
            Back to list
          </Link>
        </div>
      </header>

      <aside className="demo-data-banner" role="note">
        <span className="demo-banner-mark" aria-hidden="true">
          DEMO
        </span>
        <div>
          <strong>Fictional detail view · read only</strong>
          <p>
            This record and its activity are example content only. No live
            record is loaded, edited, or written.
          </p>
        </div>
      </aside>

      <div className="record-detail-layout">
        <main className="record-detail-main">
          <div
            className="record-detail-tabs"
            role="tablist"
            aria-label="Record sections"
          >
            {tabs.map((tab) => (
              <button
                aria-selected={activeTab === tab}
                className={
                  activeTab === tab
                    ? "record-detail-tab active"
                    : "record-detail-tab"
                }
                key={tab}
                onClick={() => onTabChange(tab)}
                role="tab"
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          <section
            aria-labelledby="record-tab-title"
            className="record-detail-panel"
            role="tabpanel"
          >
            <div className="record-detail-panel-heading">
              <div>
                <p className="eyebrow">{detailProfile.entityType}</p>
                <h2 id="record-tab-title">{activeTab}</h2>
              </div>
              <span className="demo-readonly-badge">Sample snapshot</span>
            </div>

            {isActivityTab ? (
              <ol className="record-activity-list">
                <li>
                  <span className="record-activity-dot" aria-hidden="true" />
                  <div>
                    <strong>
                      {detailProfile.entityType} added to illustrative dataset
                    </strong>
                    <small>28 Oct 2026 · 09:14</small>
                    <p>{detailProfile.summary}</p>
                  </div>
                </li>
                <li>
                  <span className="record-activity-dot" aria-hidden="true" />
                  <div>
                    <strong>
                      {detailProfile.activityTab}: {record.status}
                    </strong>
                    <small>28 Oct 2026 · 10:02</small>
                    <p>
                      This is an illustrative timeline entry, not audit evidence
                      or a server-side transition.
                    </p>
                  </div>
                </li>
              </ol>
            ) : detailProfile.layout === "comparison" &&
              activeTab === detailProfile.detailTab ? (
              <>
                <DetailLayoutNote
                  layout={detailProfile.layout}
                  summary={detailProfile.summary}
                />
                <div className="record-comparison-grid">
                  <section>
                    <h3>{detailProfile.entityType} overview</h3>
                    <dl className="record-detail-fields">
                      {overviewFields.map((field) => (
                        <div key={field.label}>
                          <dt>{field.label}</dt>
                          <dd>{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section>
                    <h3>{detailProfile.detailTab}</h3>
                    <dl className="record-detail-fields">
                      {detailFields.map((field) => (
                        <div key={field.label}>
                          <dt>{field.label}</dt>
                          <dd>{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>
              </>
            ) : (
              <>
                <DetailLayoutNote
                  layout={detailProfile.layout}
                  summary={detailProfile.summary}
                />
                <div className="record-detail-section-heading">
                  <p className="eyebrow">
                    {activeTab === detailProfile.overviewTab
                      ? "Overview"
                      : detailProfile.detailTab}
                  </p>
                  <h3>{detailProfile.entityType}</h3>
                </div>
                <dl
                  className={`record-detail-fields record-detail-fields-${detailProfile.layout}`}
                >
                  {visibleFields.map((field) => (
                    <div key={field.label}>
                      <dt>{field.label}</dt>
                      <dd>{field.value}</dd>
                    </div>
                  ))}
                </dl>
                {page.decisionNote && (
                  <aside className="module-decision-note">
                    <strong>Policy decision required</strong>
                    <p>{page.decisionNote}</p>
                  </aside>
                )}
              </>
            )}
          </section>
        </main>

        <aside className="record-detail-rail" aria-label="Record context">
          <section className="record-preview-card">
            <div className="record-preview-art" aria-hidden="true">
              {detailProfile.entityType
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word.charAt(0))
                .join("")
                .toUpperCase()}
            </div>
            <strong>{record.reference}</strong>
            <span>{detailProfile.entityType}</span>
            <span className="demo-only-badge">Illustrative</span>
          </section>

          <section className="record-rail-card">
            <h3>{detailProfile.ownerLabel}</h3>
            <p>{owner}</p>
            <small>Sample value only</small>
          </section>

          <section className="record-rail-card">
            <h3>{detailProfile.relatedTitle}</h3>
            <ul>
              {relatedItems.map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="record-rail-card">
            <h3>{detailProfile.railTitle}</h3>
            <p>{detailProfile.railNote}</p>
          </section>

          <section className="record-rail-card">
            <h3>Tags</h3>
            <div className="record-tag-list">
              <span>{page.group}</span>
              <span>{page.title}</span>
              <span>Illustrative</span>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
