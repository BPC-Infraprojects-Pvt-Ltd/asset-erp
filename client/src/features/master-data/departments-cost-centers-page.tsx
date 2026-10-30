import { isAxiosError } from "axios";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import {
  masterDataApi,
  type OrganizationMasterInput,
  type OrganizationMasterKind,
  type OrganizationMasterRecord,
} from "./master-data-api";

const masterRecordSchema = z.object({
  code: z.string().trim().min(1, "Enter a code.").max(60),
  name: z.string().trim().min(1, "Enter a name.").max(150),
});

type MasterListSearch = {
  page?: number;
  pageSize?: number;
  search?: string;
  includeInactive?: boolean;
};

function recordKindLabel(kind: OrganizationMasterKind): string {
  return kind === "department" ? "Department" : "Cost center";
}

export function DepartmentsCostCentersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/modules/$moduleId" });
  const search = useSearch({ from: "/modules/$moduleId" });
  const role = useAuthStore((state) => state.session?.user.role);
  const [activeKind, setActiveKind] =
    useState<OrganizationMasterKind>("department");
  const [editingRecord, setEditingRecord] =
    useState<OrganizationMasterRecord | null>(null);
  const [latestRecord, setLatestRecord] =
    useState<OrganizationMasterRecord | null>(null);
  const [isReviewingLatest, setIsReviewingLatest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "status">("status");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 20;
  const query = {
    page,
    pageSize,
    search: search.search || undefined,
    includeInactive: search.includeInactive || undefined,
  };
  const departmentsQuery = useQuery({
    queryKey: protectedQueryKey(
      "master-departments",
      page,
      pageSize,
      search.search ?? "",
      search.includeInactive ?? false,
    ),
    queryFn: () => masterDataApi.list("department", query),
    enabled: role === "ADMINISTRATOR" && activeKind === "department",
  });
  const costCentersQuery = useQuery({
    queryKey: protectedQueryKey(
      "master-cost-centers",
      page,
      pageSize,
      search.search ?? "",
      search.includeInactive ?? false,
    ),
    queryFn: () => masterDataApi.list("cost-center", query),
    enabled: role === "ADMINISTRATOR" && activeKind === "cost-center",
  });
  const activeQuery =
    activeKind === "department" ? departmentsQuery : costCentersQuery;

  const invalidateMasterLists = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("master-departments"),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("master-cost-centers"),
      }),
    ]);
  };
  const onMutationSuccess = async (
    kind: OrganizationMasterKind,
    record: OrganizationMasterRecord,
    verb: string,
  ) => {
    setEditingRecord(null);
    setLatestRecord(null);
    setFieldErrors({});
    reset({ code: "", name: "" });
    setMessage(`${recordKindLabel(kind)} ${verb}: ${record.name}.`);
    setMessageType("status");
    void navigate({ search: (current) => ({ ...current, page: 1 }) });
    await invalidateMasterLists();
  };
  const onMutationError = (error: unknown) => {
    setMessage(authErrorMessage(error));
    setMessageType("error");
    if (
      isAxiosError(error) &&
      error.response?.status === 409 &&
      editingRecord
    ) {
      setLatestRecord(null);
    }
  };

  const createDepartment = useMutation({
    mutationFn: (input: OrganizationMasterInput) =>
      masterDataApi.create("department", input),
    onSuccess: (record) => onMutationSuccess("department", record, "created"),
    onError: onMutationError,
  });
  const updateDepartment = useMutation({
    mutationFn: ({
      record,
      input,
    }: {
      record: OrganizationMasterRecord;
      input: OrganizationMasterInput;
    }) => masterDataApi.update("department", record.id, record.version, input),
    onSuccess: (record) => onMutationSuccess("department", record, "updated"),
    onError: onMutationError,
  });
  const setDepartmentActive = useMutation({
    mutationFn: ({
      record,
      isActive,
    }: {
      record: OrganizationMasterRecord;
      isActive: boolean;
    }) =>
      masterDataApi.setActive(
        "department",
        record.id,
        record.version,
        isActive,
      ),
    onSuccess: (record) =>
      onMutationSuccess(
        "department",
        record,
        record.isActive ? "reactivated" : "deactivated",
      ),
    onError: onMutationError,
  });
  const createCostCenter = useMutation({
    mutationFn: (input: OrganizationMasterInput) =>
      masterDataApi.create("cost-center", input),
    onSuccess: (record) => onMutationSuccess("cost-center", record, "created"),
    onError: onMutationError,
  });
  const updateCostCenter = useMutation({
    mutationFn: ({
      record,
      input,
    }: {
      record: OrganizationMasterRecord;
      input: OrganizationMasterInput;
    }) => masterDataApi.update("cost-center", record.id, record.version, input),
    onSuccess: (record) => onMutationSuccess("cost-center", record, "updated"),
    onError: onMutationError,
  });
  const setCostCenterActive = useMutation({
    mutationFn: ({
      record,
      isActive,
    }: {
      record: OrganizationMasterRecord;
      isActive: boolean;
    }) =>
      masterDataApi.setActive(
        "cost-center",
        record.id,
        record.version,
        isActive,
      ),
    onSuccess: (record) =>
      onMutationSuccess(
        "cost-center",
        record,
        record.isActive ? "reactivated" : "deactivated",
      ),
    onError: onMutationError,
  });
  const isMutating =
    createDepartment.isPending ||
    updateDepartment.isPending ||
    setDepartmentActive.isPending ||
    createCostCenter.isPending ||
    updateCostCenter.isPending ||
    setCostCenterActive.isPending;

  const { register, handleSubmit, reset } = useForm<OrganizationMasterInput>({
    defaultValues: { code: "", name: "" },
  });

  function changeListSearch(updates: Partial<MasterListSearch>) {
    setMessage(null);
    void navigate({
      search: (current) => ({ ...current, ...updates }),
    });
  }

  function changeKind(kind: OrganizationMasterKind) {
    setActiveKind(kind);
    setEditingRecord(null);
    reset({ code: "", name: "" });
    setMessage(null);
    setFieldErrors({});
    void navigate({
      search: (current) => ({ ...current, page: 1 }),
    });
  }

  const submit = handleSubmit((values) => {
    setMessage(null);
    setFieldErrors({});
    const parsed = masterRecordSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    if (editingRecord) {
      if (activeKind === "department") {
        updateDepartment.mutate({ record: editingRecord, input: parsed.data });
      } else {
        updateCostCenter.mutate({ record: editingRecord, input: parsed.data });
      }
    } else if (activeKind === "department") {
      createDepartment.mutate(parsed.data);
    } else {
      createCostCenter.mutate(parsed.data);
    }
  });

  function toggleActive(record: OrganizationMasterRecord) {
    setMessage(null);
    setLatestRecord(null);
    const input = { record, isActive: !record.isActive };
    if (activeKind === "department") setDepartmentActive.mutate(input);
    else setCostCenterActive.mutate(input);
  }

  async function loadLatestForReview() {
    if (!editingRecord) return;
    setIsReviewingLatest(true);
    setMessage(null);
    try {
      const latest = await masterDataApi.get(activeKind, editingRecord.id);
      setLatestRecord(latest);
      setMessageType("status");
      setMessage(
        "Latest server record loaded. Your draft is unchanged; review both versions before continuing.",
      );
    } catch (error) {
      setMessageType("error");
      setMessage(
        `Could not load the latest record. Your draft is unchanged. ${authErrorMessage(error)}`,
      );
    } finally {
      setIsReviewingLatest(false);
    }
  }

  if (role !== "ADMINISTRATOR") {
    return (
      <section className="master-live-page">
        <div className="page-heading">
          <p className="eyebrow">Administration</p>
          <h1>Departments &amp; cost centers</h1>
          <p className="page-description">
            These organization masters are managed by Administrators.
          </p>
        </div>
        <p className="form-error" role="alert">
          Administrator access is required.
        </p>
      </section>
    );
  }

  const maxPage = activeQuery.data
    ? Math.max(1, Math.ceil(activeQuery.data.total / activeQuery.data.pageSize))
    : 1;

  return (
    <section className="master-live-page">
      <div className="page-heading">
        <p className="eyebrow">Administration · Live data</p>
        <h1>Departments &amp; cost centers</h1>
        <p className="page-description">
          Manage organization references used by approved asset and reporting
          workflows. Identifiers remain text, including leading zeros.
        </p>
      </div>

      <div className="master-live-tabs" role="tablist" aria-label="Master type">
        <button
          aria-selected={activeKind === "department"}
          className={activeKind === "department" ? "active" : ""}
          onClick={() => changeKind("department")}
          role="tab"
          type="button"
        >
          Departments
        </button>
        <button
          aria-selected={activeKind === "cost-center"}
          className={activeKind === "cost-center" ? "active" : ""}
          onClick={() => changeKind("cost-center")}
          role="tab"
          type="button"
        >
          Cost centers
        </button>
        <span className="master-live-badge">API connected</span>
      </div>

      <div className="master-live-layout">
        <section className="user-admin-card modern-form-card">
          <div className="form-card-heading">
            <span className="form-step-mark" aria-hidden="true">
              {editingRecord ? "ED" : "01"}
            </span>
            <div>
              <p className="eyebrow">
                {activeKind === "department"
                  ? "Organization structure"
                  : "Financial reference"}
              </p>
              <h2>
                {editingRecord
                  ? `Edit ${recordKindLabel(activeKind).toLocaleLowerCase()}`
                  : `Create ${recordKindLabel(activeKind).toLocaleLowerCase()}`}
              </h2>
              <p>
                {activeKind === "department"
                  ? "Use a stable code and recognizable department name."
                  : "Cost center identifiers are preserved as strings."}
              </p>
            </div>
          </div>

          <form
            className="user-create-form modern-form"
            noValidate
            onSubmit={submit}
          >
            <div className="modern-form-grid master-live-form-grid">
              <div className="modern-field">
                <label htmlFor="master-code">Code</label>
                <input
                  id="master-code"
                  maxLength={60}
                  placeholder={
                    activeKind === "department" ? "e.g. IT-OPS" : "e.g. 00418"
                  }
                  {...register("code")}
                  aria-invalid={Boolean(fieldErrors.code)}
                />
                <small>
                  {activeKind === "department"
                    ? "Codes are stored uppercase and unique within your organization."
                    : "Enter as text to preserve any leading zeros."}
                </small>
                {fieldErrors.code && (
                  <span className="field-error" role="alert">
                    {fieldErrors.code}
                  </span>
                )}
              </div>
              <div className="modern-field">
                <label htmlFor="master-name">Name</label>
                <input
                  id="master-name"
                  maxLength={150}
                  placeholder={
                    activeKind === "department"
                      ? "e.g. IT Operations"
                      : "e.g. Information Technology"
                  }
                  {...register("name")}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name && (
                  <span className="field-error" role="alert">
                    {fieldErrors.name}
                  </span>
                )}
              </div>
            </div>

            {message && (
              <p
                className={
                  messageType === "error"
                    ? "form-error master-live-message"
                    : "form-notice master-live-message"
                }
                role={messageType === "error" ? "alert" : "status"}
              >
                {message}
              </p>
            )}

            <div className="modern-form-actions master-live-form-actions">
              <div>
                <strong>
                  {editingRecord
                    ? `Saving version ${editingRecord.version}`
                    : "Changes are organization scoped"}
                </strong>
                <small>
                  {editingRecord
                    ? "Concurrent edits are checked using the record version."
                    : "Referenced records are deactivated, never deleted."}
                </small>
              </div>
              <div className="user-form-actions">
                <button className="button" disabled={isMutating} type="submit">
                  {isMutating
                    ? "Saving…"
                    : editingRecord
                      ? "Save changes"
                      : `Create ${recordKindLabel(activeKind).toLocaleLowerCase()}`}
                </button>
                {editingRecord && (
                  <button
                    className="button button-secondary"
                    disabled={isMutating}
                    onClick={() => {
                      setMessage(null);
                      setFieldErrors({});
                      reset({ code: "", name: "" });
                      setEditingRecord(null);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            {editingRecord && message && !latestRecord && (
              <div className="master-live-conflict-actions">
                <p>
                  Your edit is still in the form. Review the latest server
                  version before deciding whether to keep or replace it.
                </p>
                <button
                  className="button button-secondary"
                  disabled={isReviewingLatest || isMutating}
                  onClick={() => void loadLatestForReview()}
                  type="button"
                >
                  {isReviewingLatest
                    ? "Loading latest…"
                    : "Load latest for review"}
                </button>
              </div>
            )}
            {editingRecord && latestRecord && (
              <section
                className="master-live-conflict-review"
                aria-label="Latest server record"
              >
                <div>
                  <p className="eyebrow">Latest server version</p>
                  <h3>
                    Version {latestRecord.version} ·{" "}
                    {latestRecord.isActive ? "Active" : "Inactive"}
                  </h3>
                </div>
                <dl>
                  <div>
                    <dt>Code</dt>
                    <dd>{latestRecord.code}</dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>{latestRecord.name}</dd>
                  </div>
                </dl>
                <button
                  className="button button-secondary"
                  disabled={isReviewingLatest || isMutating}
                  onClick={() => {
                    reset({ code: latestRecord.code, name: latestRecord.name });
                    setEditingRecord(latestRecord);
                    setLatestRecord(null);
                    setMessage(null);
                  }}
                  type="button"
                >
                  Discard draft and edit latest version
                </button>
              </section>
            )}
          </form>
        </section>

        <aside className="master-live-aside">
          <p className="eyebrow">Master data</p>
          <h2>{activeKind === "department" ? "Department" : "Cost center"}</h2>
          <p>
            {activeKind === "department"
              ? "Department records can be referenced by assets and operational reporting."
              : "Cost center codes are not converted to numbers, so formatting is preserved."}
          </p>
          <Link
            className="master-live-demo-link"
            params={{ moduleId: "departments-cost-centers" }}
            search={{ demo: true }}
            to="/modules/$moduleId"
          >
            View illustrative examples
          </Link>
        </aside>
      </div>

      <section className="user-admin-card master-live-list-card">
        <div className="master-live-list-heading">
          <div>
            <p className="eyebrow">Organization records</p>
            <h2>
              {activeKind === "department" ? "Departments" : "Cost centers"}
            </h2>
          </div>
          {activeQuery.data && (
            <span className="master-live-total">
              {activeQuery.data.total} total
            </span>
          )}
        </div>

        <div className="master-live-toolbar">
          <label className="master-live-search">
            <span>Search records</span>
            <input
              onChange={(event) =>
                changeListSearch({ search: event.target.value, page: 1 })
              }
              placeholder="Search code or name"
              value={search.search ?? ""}
            />
          </label>
          <label className="asset-category-inactive-toggle">
            <input
              checked={search.includeInactive ?? false}
              onChange={(event) =>
                changeListSearch({
                  includeInactive: event.target.checked || undefined,
                  page: 1,
                })
              }
              type="checkbox"
            />
            Show inactive records
          </label>
        </div>

        {activeQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(activeQuery.error)}
          </p>
        )}
        {activeQuery.isFetching && !activeQuery.isPending && (
          <p className="form-notice" role="status">
            Refreshing{" "}
            {activeKind === "department" ? "departments" : "cost centers"}…
          </p>
        )}
        {activeQuery.isPending ? (
          <p className="master-live-state" role="status">
            Loading organization records…
          </p>
        ) : activeQuery.isError ? null : activeQuery.data?.items.length ? (
          <div className="user-table-scroll">
            <table className="user-table master-live-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Status</th>
                  <th scope="col">Version</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeQuery.data.items.map((record) => (
                  <tr key={record.id}>
                    <td className="master-live-code">{record.code}</td>
                    <td>{record.name}</td>
                    <td>
                      <span
                        className={
                          record.isActive
                            ? "master-live-status active"
                            : "master-live-status inactive"
                        }
                      >
                        {record.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{record.version}</td>
                    <td>
                      <div className="user-row-actions">
                        <button
                          className="button button-secondary"
                          disabled={isMutating}
                          onClick={() => {
                            setMessage(null);
                            setLatestRecord(null);
                            setFieldErrors({});
                            reset({ code: record.code, name: record.name });
                            setEditingRecord(record);
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="button button-secondary"
                          disabled={isMutating}
                          onClick={() => toggleActive(record)}
                          type="button"
                        >
                          {record.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="master-live-empty">
            <span className="module-connection-mark" aria-hidden="true">
              {activeKind === "department" ? "DP" : "CC"}
            </span>
            <div>
              <strong>
                {search.search
                  ? `No ${activeKind === "department" ? "departments" : "cost centers"} match this search`
                  : search.includeInactive
                    ? `No ${activeKind === "department" ? "departments" : "cost centers"} have been added`
                    : `No active ${activeKind === "department" ? "departments" : "cost centers"} yet`}
              </strong>
              <p>
                {search.search
                  ? "Clear or adjust the search to see other organization records."
                  : "Create the first organization record using the form above."}
              </p>
            </div>
          </div>
        )}

        {activeQuery.data && (
          <div
            className="asset-pagination"
            aria-label="Organization master pages"
          >
            <span>
              Page {activeQuery.data.page} of {maxPage}
            </span>
            <button
              className="button button-secondary"
              disabled={page <= 1 || activeQuery.isFetching}
              onClick={() => changeListSearch({ page: page - 1 })}
              type="button"
            >
              Previous
            </button>
            <button
              className="button button-secondary"
              disabled={page >= maxPage || activeQuery.isFetching}
              onClick={() => changeListSearch({ page: page + 1 })}
              type="button"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
