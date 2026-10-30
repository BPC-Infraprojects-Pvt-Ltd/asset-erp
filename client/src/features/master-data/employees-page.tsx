import { isAxiosError } from "axios";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import {
  masterDataApi,
  type EmployeeInput,
  type EmployeeRecord,
  type OrganizationMasterListQuery,
} from "./master-data-api";

const employeeSchema = z.object({
  employeeNumber: z
    .string()
    .trim()
    .min(1, "Enter an employee number.")
    .max(150),
  displayName: z.string().trim().min(1, "Enter an employee name.").max(160),
});

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/modules/$moduleId" });
  const search = useSearch({ from: "/modules/$moduleId" });
  const role = useAuthStore((state) => state.session?.user.role);
  const isAdministrator = role === "ADMINISTRATOR";
  const canRead = isAdministrator || role === "ASSET_MANAGER";
  const [editingRecord, setEditingRecord] = useState<EmployeeRecord | null>(
    null,
  );
  const [latestRecord, setLatestRecord] = useState<EmployeeRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 20;
  const query: OrganizationMasterListQuery = {
    page,
    pageSize,
    search: search.search || undefined,
    includeInactive: (isAdministrator && search.includeInactive) || undefined,
  };
  const employeesQuery = useQuery({
    queryKey: protectedQueryKey(
      "master-employees",
      page,
      pageSize,
      search.search ?? "",
      isAdministrator && (search.includeInactive ?? false),
    ),
    queryFn: () => masterDataApi.listEmployees(query),
    enabled: canRead,
  });
  const { register, handleSubmit, reset } = useForm<EmployeeInput>({
    defaultValues: { employeeNumber: "", displayName: "" },
  });
  const invalidateEmployees = async () => {
    await queryClient.invalidateQueries({
      queryKey: protectedQueryKey("master-employees"),
    });
  };
  const onSuccess = async (
    record: EmployeeRecord,
    action: "created" | "updated" | "deactivated" | "reactivated",
  ) => {
    setEditingRecord(null);
    setLatestRecord(null);
    setFieldErrors({});
    reset({ employeeNumber: "", displayName: "" });
    setMessageIsError(false);
    setMessage(`Employee reference ${action}: ${record.displayName}.`);
    void navigate({ search: (current) => ({ ...current, page: 1 }) });
    await invalidateEmployees();
  };
  const onError = (error: unknown) => {
    setMessage(authErrorMessage(error));
    setMessageIsError(true);
    if (
      isAxiosError(error) &&
      error.response?.status === 409 &&
      editingRecord
    ) {
      setLatestRecord(null);
    }
  };
  const createEmployee = useMutation({
    mutationFn: masterDataApi.createEmployee,
    onSuccess: (record) => onSuccess(record, "created"),
    onError,
  });
  const updateEmployee = useMutation({
    mutationFn: ({
      record,
      input,
    }: {
      record: EmployeeRecord;
      input: EmployeeInput;
    }) => masterDataApi.updateEmployee(record.id, record.version, input),
    onSuccess: (record) => onSuccess(record, "updated"),
    onError,
  });
  const setEmployeeActive = useMutation({
    mutationFn: ({
      record,
      isActive,
    }: {
      record: EmployeeRecord;
      isActive: boolean;
    }) => masterDataApi.setEmployeeActive(record.id, record.version, isActive),
    onSuccess: (record) =>
      onSuccess(record, record.isActive ? "reactivated" : "deactivated"),
    onError,
  });
  const isMutating =
    createEmployee.isPending ||
    updateEmployee.isPending ||
    setEmployeeActive.isPending;

  function changeSearch(updates: Partial<OrganizationMasterListQuery>) {
    setMessage(null);
    void navigate({ search: (current) => ({ ...current, ...updates }) });
  }

  const submit = handleSubmit((values) => {
    setMessage(null);
    setMessageIsError(false);
    setFieldErrors({});
    const parsed = employeeSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      return;
    }
    if (editingRecord) {
      updateEmployee.mutate({ record: editingRecord, input: parsed.data });
    } else {
      createEmployee.mutate(parsed.data);
    }
  });

  async function loadLatestForReview() {
    if (!editingRecord) return;
    setMessage(null);
    try {
      const latest = await masterDataApi.getEmployee(editingRecord.id);
      setLatestRecord(latest);
      setMessageIsError(false);
      setMessage(
        "Latest server reference loaded. Your draft is unchanged; review both versions before continuing.",
      );
    } catch (error) {
      setMessageIsError(true);
      setMessage(
        `Could not load the latest reference. Your draft is unchanged. ${authErrorMessage(error)}`,
      );
    }
  }

  if (!canRead) {
    return (
      <section>
        <div className="page-heading">
          <p className="eyebrow">Administration</p>
          <h1>Employees</h1>
          <p className="page-description">
            Employee references are limited to authorized organization roles.
          </p>
        </div>
        <p className="form-error" role="alert">
          Employee references are not available to this role.
        </p>
      </section>
    );
  }

  return (
    <section className="master-live-page">
      <div className="page-heading">
        <p className="eyebrow">Administration · Live data</p>
        <h1>Employees</h1>
        <p className="page-description">
          Maintain the minimum employee reference needed for equipment
          assignment. Employee records are separate from sign-in accounts.
        </p>
      </div>

      <aside className="module-connection-card" role="note">
        <span className="module-connection-mark" aria-hidden="true">
          ID
        </span>
        <div>
          <p className="eyebrow">Limited identity data</p>
          <h2>Employee references do not require a login</h2>
          <p>
            This roster stores only an employee number and display name. It does
            not link employees to user accounts or collect contact/HR data.
          </p>
        </div>
      </aside>

      {isAdministrator && (
        <section className="user-admin-card modern-form-card">
          <div className="form-card-heading">
            <span className="form-step-mark" aria-hidden="true">
              {editingRecord ? "ED" : "01"}
            </span>
            <div>
              <p className="eyebrow">Employee directory</p>
              <h2>
                {editingRecord
                  ? "Edit employee reference"
                  : "Add employee reference"}
              </h2>
              <p>
                Enter the minimum identity details required for assigned
                operations.
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
                <label htmlFor="employee-number">Employee number</label>
                <input
                  id="employee-number"
                  autoComplete="off"
                  maxLength={150}
                  placeholder="e.g. 000184"
                  {...register("employeeNumber")}
                  aria-invalid={Boolean(fieldErrors.employeeNumber)}
                />
                <small>Kept as text; leading zeros are preserved.</small>
                {fieldErrors.employeeNumber && (
                  <span className="field-error" role="alert">
                    {fieldErrors.employeeNumber}
                  </span>
                )}
              </div>
              <div className="modern-field">
                <label htmlFor="employee-name">Display name</label>
                <input
                  id="employee-name"
                  autoComplete="off"
                  maxLength={160}
                  placeholder="e.g. Tara Menon"
                  {...register("displayName")}
                  aria-invalid={Boolean(fieldErrors.displayName)}
                />
                {fieldErrors.displayName && (
                  <span className="field-error" role="alert">
                    {fieldErrors.displayName}
                  </span>
                )}
              </div>
            </div>
            {message && (
              <p
                className={
                  messageIsError
                    ? "form-error master-live-message"
                    : "form-notice master-live-message"
                }
                role={messageIsError ? "alert" : "status"}
              >
                {message}
              </p>
            )}
            <div className="modern-form-actions master-live-form-actions">
              <div>
                <strong>
                  {editingRecord
                    ? `Saving version ${editingRecord.version}`
                    : "Separate from sign-in accounts"}
                </strong>
                <small>
                  Duplicate employee numbers are prevented within the
                  organization.
                </small>
              </div>
              <div className="user-form-actions">
                <button className="button" disabled={isMutating} type="submit">
                  {isMutating
                    ? "Saving…"
                    : editingRecord
                      ? "Save changes"
                      : "Create employee"}
                </button>
                {editingRecord && (
                  <button
                    className="button button-secondary"
                    disabled={isMutating}
                    onClick={() => {
                      setEditingRecord(null);
                      setLatestRecord(null);
                      setFieldErrors({});
                      setMessage(null);
                      reset({ employeeNumber: "", displayName: "" });
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            {editingRecord && messageIsError && !latestRecord && (
              <div className="master-live-conflict-actions">
                <p>
                  Your draft is preserved. Review the current server version
                  before deciding how to continue.
                </p>
                <button
                  className="button button-secondary"
                  disabled={isMutating}
                  onClick={() => void loadLatestForReview()}
                  type="button"
                >
                  Load latest for review
                </button>
              </div>
            )}
            {editingRecord && latestRecord && (
              <section className="master-live-conflict-review">
                <div>
                  <p className="eyebrow">Latest server version</p>
                  <h3>
                    Version {latestRecord.version} ·{" "}
                    {latestRecord.isActive ? "Active" : "Inactive"}
                  </h3>
                </div>
                <dl>
                  <div>
                    <dt>Employee number</dt>
                    <dd>{latestRecord.employeeNumber}</dd>
                  </div>
                  <div>
                    <dt>Display name</dt>
                    <dd>{latestRecord.displayName}</dd>
                  </div>
                </dl>
                <button
                  className="button button-secondary"
                  disabled={isMutating}
                  onClick={() => {
                    reset({
                      employeeNumber: latestRecord.employeeNumber,
                      displayName: latestRecord.displayName,
                    });
                    setEditingRecord(latestRecord);
                    setLatestRecord(null);
                    setMessage(null);
                    setMessageIsError(false);
                  }}
                  type="button"
                >
                  Discard draft and edit latest version
                </button>
              </section>
            )}
          </form>
        </section>
      )}

      <section className="user-admin-card master-live-list-card">
        <div className="master-live-list-heading">
          <div>
            <p className="eyebrow">Organization records</p>
            <h2>Employee references</h2>
          </div>
          {employeesQuery.data && (
            <span className="master-live-total">
              {employeesQuery.data.total} total
            </span>
          )}
        </div>
        <div className="master-live-toolbar">
          <label className="master-live-search">
            <span>Search employees</span>
            <input
              onChange={(event) =>
                changeSearch({ search: event.target.value, page: 1 })
              }
              placeholder="Search number or name"
              value={search.search ?? ""}
            />
          </label>
          {isAdministrator && (
            <label className="asset-category-inactive-toggle">
              <input
                checked={search.includeInactive ?? false}
                onChange={(event) =>
                  changeSearch({
                    includeInactive: event.target.checked || undefined,
                    page: 1,
                  })
                }
                type="checkbox"
              />
              Show inactive
            </label>
          )}
        </div>

        {employeesQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(employeesQuery.error)}
          </p>
        )}
        {employeesQuery.isPending ? (
          <p className="master-live-state" role="status">
            Loading employee references…
          </p>
        ) : employeesQuery.isError ? null : employeesQuery.data?.items
            .length ? (
          <div className="user-table-scroll">
            <table className="user-table master-live-table">
              <thead>
                <tr>
                  <th scope="col">Employee number</th>
                  <th scope="col">Display name</th>
                  <th scope="col">Status</th>
                  <th scope="col">Version</th>
                  {isAdministrator && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {employeesQuery.data.items.map((record) => (
                  <tr key={record.id}>
                    <td className="master-live-code">
                      {record.employeeNumber}
                    </td>
                    <td>{record.displayName}</td>
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
                    {isAdministrator && (
                      <td>
                        <div className="user-row-actions">
                          <button
                            className="button button-secondary"
                            disabled={isMutating}
                            onClick={() => {
                              setMessage(null);
                              setMessageIsError(false);
                              setLatestRecord(null);
                              setFieldErrors({});
                              reset({
                                employeeNumber: record.employeeNumber,
                                displayName: record.displayName,
                              });
                              setEditingRecord(record);
                            }}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="button button-secondary"
                            disabled={isMutating}
                            onClick={() =>
                              setEmployeeActive.mutate({
                                record,
                                isActive: !record.isActive,
                              })
                            }
                            type="button"
                          >
                            {record.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="master-live-empty">
            <span className="module-connection-mark" aria-hidden="true">
              EMP
            </span>
            <div>
              <strong>
                {search.search
                  ? "No employee references match this search"
                  : search.includeInactive
                    ? "No employee references have been added"
                    : "No active employee references"}
              </strong>
              <p>
                {isAdministrator
                  ? "Add a minimal employee reference using the form above."
                  : "No active employee references are available."}
              </p>
            </div>
          </div>
        )}

        {employeesQuery.data && (
          <div className="asset-pagination" aria-label="Employee pages">
            <span>
              Page {employeesQuery.data.page} of{" "}
              {Math.max(
                1,
                Math.ceil(
                  employeesQuery.data.total / employeesQuery.data.pageSize,
                ),
              )}
            </span>
            <button
              className="button button-secondary"
              disabled={page <= 1 || employeesQuery.isFetching}
              onClick={() => changeSearch({ page: page - 1 })}
              type="button"
            >
              Previous
            </button>
            <button
              className="button button-secondary"
              disabled={
                page >=
                  Math.max(
                    1,
                    Math.ceil(
                      employeesQuery.data.total / employeesQuery.data.pageSize,
                    ),
                  ) || employeesQuery.isFetching
              }
              onClick={() => changeSearch({ page: page + 1 })}
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
