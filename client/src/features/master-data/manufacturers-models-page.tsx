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
  type AssetModelInput,
  type AssetModelRecord,
  type ManufacturerInput,
  type ManufacturerRecord,
  type OrganizationMasterListQuery,
} from "./master-data-api";

const manufacturerSchema = z.object({
  name: z.string().trim().min(1, "Enter a manufacturer name.").max(150),
});

const assetModelSchema = z.object({
  manufacturerId: z.string().uuid("Choose a manufacturer."),
  name: z.string().trim().min(1, "Enter a model name.").max(150),
});

type CatalogTab = "manufacturers" | "models";
type CatalogRecord =
  | { kind: "manufacturer"; record: ManufacturerRecord }
  | { kind: "model"; record: AssetModelRecord };
type EditingCatalogRecord =
  | { kind: "manufacturer"; record: ManufacturerRecord }
  | { kind: "model"; record: AssetModelRecord };
type FormValues = { name: string; manufacturerId: string };
type ListSearch = OrganizationMasterListQuery;

export function ManufacturersModelsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/modules/$moduleId" });
  const search = useSearch({ from: "/modules/$moduleId" });
  const role = useAuthStore((state) => state.session?.user.role);
  const canRead =
    role === "ADMINISTRATOR" ||
    role === "ASSET_MANAGER" ||
    role === "TECHNICIAN";
  const isAdministrator = role === "ADMINISTRATOR";
  const [activeTab, setActiveTab] = useState<CatalogTab>("manufacturers");
  const [editing, setEditing] = useState<EditingCatalogRecord | null>(null);
  const [latestRecord, setLatestRecord] = useState<CatalogRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [manufacturerSearch, setManufacturerSearch] = useState("");
  const [manufacturerPage, setManufacturerPage] = useState(1);
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 20;
  const query: OrganizationMasterListQuery = {
    page,
    pageSize,
    search: search.search || undefined,
    includeInactive: (isAdministrator && search.includeInactive) || undefined,
  };
  const manufacturersQuery = useQuery({
    queryKey: protectedQueryKey(
      "manufacturers",
      page,
      pageSize,
      search.search ?? "",
      isAdministrator && (search.includeInactive ?? false),
    ),
    queryFn: () => masterDataApi.listManufacturers(query),
    enabled: canRead && activeTab === "manufacturers",
  });
  const modelsQuery = useQuery({
    queryKey: protectedQueryKey(
      "asset-models",
      page,
      pageSize,
      search.search ?? "",
      isAdministrator && (search.includeInactive ?? false),
    ),
    queryFn: () => masterDataApi.listAssetModels(query),
    enabled: canRead && activeTab === "models",
  });
  const manufacturerOptionsQuery = useQuery({
    queryKey: protectedQueryKey(
      "manufacturer-options",
      manufacturerPage,
      manufacturerSearch,
    ),
    queryFn: () =>
      masterDataApi.listManufacturers({
        page: manufacturerPage,
        pageSize: 20,
        search: manufacturerSearch || undefined,
      }),
    enabled: isAdministrator && activeTab === "models",
  });
  const activeQuery =
    activeTab === "manufacturers" ? manufacturersQuery : modelsQuery;
  const invalidateCatalog = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("manufacturers"),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("asset-models"),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("manufacturer-options"),
      }),
    ]);
  };
  const onSuccess = async (label: string, name: string, verb: string) => {
    setEditing(null);
    setLatestRecord(null);
    setFieldErrors({});
    reset({ name: "", manufacturerId: "" });
    setMessageIsError(false);
    setMessage(`${label} ${verb}: ${name}.`);
    void navigate({ search: (current) => ({ ...current, page: 1 }) });
    await invalidateCatalog();
  };
  const onError = (error: unknown) => {
    setMessage(authErrorMessage(error));
    setMessageIsError(true);
    if (isAxiosError(error) && error.response?.status === 409 && editing) {
      setLatestRecord(null);
    }
  };
  const createManufacturer = useMutation({
    mutationFn: (input: ManufacturerInput) =>
      masterDataApi.createManufacturer(input),
    onSuccess: (record) => onSuccess("Manufacturer", record.name, "created"),
    onError,
  });
  const updateManufacturer = useMutation({
    mutationFn: ({
      record,
      input,
    }: {
      record: ManufacturerRecord;
      input: ManufacturerInput;
    }) => masterDataApi.updateManufacturer(record.id, record.version, input),
    onSuccess: (record) => onSuccess("Manufacturer", record.name, "updated"),
    onError,
  });
  const setManufacturerActive = useMutation({
    mutationFn: ({
      record,
      isActive,
    }: {
      record: ManufacturerRecord;
      isActive: boolean;
    }) =>
      masterDataApi.setManufacturerActive(record.id, record.version, isActive),
    onSuccess: (record) =>
      onSuccess(
        "Manufacturer",
        record.name,
        record.isActive ? "reactivated" : "deactivated",
      ),
    onError,
  });
  const createModel = useMutation({
    mutationFn: (input: AssetModelInput) =>
      masterDataApi.createAssetModel(input),
    onSuccess: (record) => onSuccess("Model", record.name, "created"),
    onError,
  });
  const updateModel = useMutation({
    mutationFn: ({
      record,
      input,
    }: {
      record: AssetModelRecord;
      input: AssetModelInput;
    }) => masterDataApi.updateAssetModel(record.id, record.version, input),
    onSuccess: (record) => onSuccess("Model", record.name, "updated"),
    onError,
  });
  const setModelActive = useMutation({
    mutationFn: ({
      record,
      isActive,
    }: {
      record: AssetModelRecord;
      isActive: boolean;
    }) =>
      masterDataApi.setAssetModelActive(record.id, record.version, isActive),
    onSuccess: (record) =>
      onSuccess(
        "Model",
        record.name,
        record.isActive ? "reactivated" : "deactivated",
      ),
    onError,
  });
  const isMutating =
    createManufacturer.isPending ||
    updateManufacturer.isPending ||
    setManufacturerActive.isPending ||
    createModel.isPending ||
    updateModel.isPending ||
    setModelActive.isPending;
  const { register, handleSubmit, reset, setValue } = useForm<FormValues>({
    defaultValues: { name: "", manufacturerId: "" },
  });
  const maxPage = activeQuery.data
    ? Math.max(1, Math.ceil(activeQuery.data.total / activeQuery.data.pageSize))
    : 1;

  function changeListSearch(updates: Partial<ListSearch>) {
    setMessage(null);
    void navigate({ search: (current) => ({ ...current, ...updates }) });
  }

  function changeTab(tab: CatalogTab) {
    setActiveTab(tab);
    setEditing(null);
    setLatestRecord(null);
    setFieldErrors({});
    setMessage(null);
    reset({ name: "", manufacturerId: "" });
    void navigate({ search: (current) => ({ ...current, page: 1 }) });
  }

  const submit = handleSubmit((values) => {
    setMessage(null);
    setFieldErrors({});
    if (activeTab === "manufacturers") {
      const parsed = manufacturerSchema.safeParse({ name: values.name });
      if (!parsed.success) {
        setFieldErrors({
          name: parsed.error.issues[0]?.message ?? "Invalid name.",
        });
        return;
      }
      if (editing && editing.kind === "manufacturer") {
        updateManufacturer.mutate({
          record: editing.record,
          input: parsed.data,
        });
      } else {
        createManufacturer.mutate(parsed.data);
      }
      return;
    }

    const parsed = assetModelSchema.safeParse(values);
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
    if (editing && editing.kind === "model") {
      updateModel.mutate({ record: editing.record, input: parsed.data });
    } else {
      createModel.mutate(parsed.data);
    }
  });

  async function loadLatestForReview() {
    if (!editing) return;
    setMessage(null);
    try {
      if (editing.kind === "manufacturer") {
        const latest = await masterDataApi.getManufacturer(editing.record.id);
        setLatestRecord({ kind: "manufacturer", record: latest });
      } else {
        const latest = await masterDataApi.getAssetModel(editing.record.id);
        setLatestRecord({ kind: "model", record: latest });
      }
      setMessageIsError(false);
      setMessage("Latest server version loaded. Your draft is unchanged.");
    } catch (error) {
      setMessageIsError(true);
      setMessage(
        `Could not load the latest version. Your draft is unchanged. ${authErrorMessage(error)}`,
      );
    }
  }

  function adoptLatestRecord() {
    if (!latestRecord) return;
    if (latestRecord.kind === "manufacturer") {
      reset({ name: latestRecord.record.name, manufacturerId: "" });
      setEditing({ kind: "manufacturer", record: latestRecord.record });
    } else {
      setManufacturerSearch(latestRecord.record.manufacturer.name);
      setManufacturerPage(1);
      reset({
        name: latestRecord.record.name,
        manufacturerId: latestRecord.record.manufacturerId,
      });
      setEditing({ kind: "model", record: latestRecord.record });
    }
    setLatestRecord(null);
    setMessage(null);
  }

  function toggleActive(record: CatalogRecord) {
    setMessage(null);
    setLatestRecord(null);
    if (record.kind === "manufacturer") {
      setManufacturerActive.mutate({
        record: record.record,
        isActive: !record.record.isActive,
      });
    } else {
      setModelActive.mutate({
        record: record.record,
        isActive: !record.record.isActive,
      });
    }
  }

  if (!canRead) {
    return (
      <section>
        <div className="page-heading">
          <p className="eyebrow">Administration</p>
          <h1>Manufacturers &amp; models</h1>
          <p className="page-description">
            These operational master records are not available to your role.
          </p>
        </div>
        <p className="form-error" role="alert">
          Manufacturer and model access is not available to this role.
        </p>
      </section>
    );
  }

  return (
    <section className="master-live-page">
      <div className="page-heading">
        <p className="eyebrow">Administration · Live data</p>
        <h1>Manufacturers &amp; models</h1>
        <p className="page-description">
          Maintain organization-scoped manufacturer and model references for
          hardware records.
        </p>
      </div>

      <div
        className="master-live-tabs"
        role="tablist"
        aria-label="Hardware master type"
      >
        <button
          aria-selected={activeTab === "manufacturers"}
          className={activeTab === "manufacturers" ? "active" : ""}
          onClick={() => changeTab("manufacturers")}
          role="tab"
          type="button"
        >
          Manufacturers
        </button>
        <button
          aria-selected={activeTab === "models"}
          className={activeTab === "models" ? "active" : ""}
          onClick={() => changeTab("models")}
          role="tab"
          type="button"
        >
          Models
        </button>
        <span className="master-live-badge">API connected</span>
      </div>

      <div className="master-live-layout">
        {isAdministrator && (
          <section className="user-admin-card modern-form-card">
            <div className="form-card-heading">
              <span className="form-step-mark" aria-hidden="true">
                {editing ? "ED" : "01"}
              </span>
              <div>
                <p className="eyebrow">Hardware catalog</p>
                <h2>
                  {editing
                    ? `Edit ${editing.kind === "manufacturer" ? "manufacturer" : "model"}`
                    : `Create ${activeTab === "manufacturers" ? "manufacturer" : "model"}`}
                </h2>
                <p>
                  {activeTab === "manufacturers"
                    ? "Manufacturer names are unique within your organization."
                    : "Choose the manufacturer that owns this model reference."}
                </p>
              </div>
            </div>
            <form
              className="user-create-form modern-form"
              noValidate
              onSubmit={submit}
            >
              <div className="modern-form-grid master-live-form-grid">
                {activeTab === "models" && (
                  <div className="modern-field modern-field-wide">
                    <label htmlFor="manufacturer-search">
                      Find manufacturer
                    </label>
                    <input
                      id="manufacturer-search"
                      placeholder="Search manufacturers"
                      value={manufacturerSearch}
                      onChange={(event) => {
                        setManufacturerSearch(event.target.value);
                        setManufacturerPage(1);
                        setValue("manufacturerId", "");
                      }}
                    />
                    <label htmlFor="model-manufacturer">Manufacturer</label>
                    <select
                      id="model-manufacturer"
                      {...register("manufacturerId")}
                    >
                      <option value="">Select a manufacturer</option>
                      {manufacturerOptionsQuery.data?.items
                        .filter((item) => item.isActive)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                    {manufacturerOptionsQuery.isError && (
                      <span className="field-error" role="alert">
                        {authErrorMessage(manufacturerOptionsQuery.error)}
                      </span>
                    )}
                    {manufacturerOptionsQuery.data?.total === 0 && (
                      <small>No active manufacturers are available yet.</small>
                    )}
                    {manufacturerOptionsQuery.data && (
                      <div className="asset-choice-pagination">
                        <button
                          className="button button-secondary"
                          disabled={
                            manufacturerPage <= 1 ||
                            manufacturerOptionsQuery.isFetching
                          }
                          onClick={() => {
                            setManufacturerPage((current) => current - 1);
                            setValue("manufacturerId", "");
                          }}
                          type="button"
                        >
                          Previous manufacturers
                        </button>
                        <button
                          className="button button-secondary"
                          disabled={
                            manufacturerOptionsQuery.isFetching ||
                            manufacturerPage *
                              manufacturerOptionsQuery.data.pageSize >=
                              manufacturerOptionsQuery.data.total
                          }
                          onClick={() => {
                            setManufacturerPage((current) => current + 1);
                            setValue("manufacturerId", "");
                          }}
                          type="button"
                        >
                          More manufacturers
                        </button>
                      </div>
                    )}
                    {fieldErrors.manufacturerId && (
                      <span className="field-error" role="alert">
                        {fieldErrors.manufacturerId}
                      </span>
                    )}
                  </div>
                )}
                <div className="modern-field modern-field-wide">
                  <label htmlFor="catalog-name">
                    {activeTab === "manufacturers"
                      ? "Manufacturer name"
                      : "Model name"}
                  </label>
                  <input
                    id="catalog-name"
                    maxLength={150}
                    placeholder={
                      activeTab === "manufacturers"
                        ? "e.g. Northwind Devices"
                        : "e.g. ThinkPad T14"
                    }
                    {...register("name")}
                  />
                  <small>
                    {activeTab === "manufacturers"
                      ? "Names are matched case-insensitively within your organization."
                      : "Model names are unique within the selected manufacturer."}
                  </small>
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
                    {editing
                      ? `Saving version ${editing.record.version}`
                      : "Changes are organization scoped"}
                  </strong>
                  <small>Updates are protected by a version check.</small>
                </div>
                <div className="user-form-actions">
                  <button
                    className="button"
                    disabled={isMutating}
                    type="submit"
                  >
                    {isMutating
                      ? "Saving…"
                      : editing
                        ? "Save changes"
                        : `Create ${activeTab === "manufacturers" ? "manufacturer" : "model"}`}
                  </button>
                  {editing && (
                    <button
                      className="button button-secondary"
                      disabled={isMutating}
                      onClick={() => {
                        setEditing(null);
                        setLatestRecord(null);
                        setMessage(null);
                        reset({ name: "", manufacturerId: "" });
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              {editing && messageIsError && !latestRecord && (
                <button
                  className="button button-secondary"
                  disabled={isMutating}
                  onClick={() => void loadLatestForReview()}
                  type="button"
                >
                  Load latest for review
                </button>
              )}
              {editing && latestRecord && (
                <section className="master-live-conflict-review">
                  <div>
                    <p className="eyebrow">Latest server version</p>
                    <h3>Version {latestRecord.record.version}</h3>
                  </div>
                  <dl>
                    <div>
                      <dt>Name</dt>
                      <dd>{latestRecord.record.name}</dd>
                    </div>
                    {latestRecord.kind === "model" && (
                      <div>
                        <dt>Manufacturer</dt>
                        <dd>{latestRecord.record.manufacturer.name}</dd>
                      </div>
                    )}
                  </dl>
                  <button
                    className="button button-secondary"
                    disabled={isMutating}
                    onClick={adoptLatestRecord}
                    type="button"
                  >
                    Discard draft and edit latest version
                  </button>
                </section>
              )}
            </form>
          </section>
        )}

        <aside className="master-live-aside">
          <p className="eyebrow">Master data</p>
          <h2>
            {activeTab === "manufacturers" ? "Manufacturer" : "Asset model"}
          </h2>
          <p>
            {isAdministrator
              ? "Inactive references remain available for historical display; records are never hard-deleted."
              : "Read-only operational references for authorized hardware work."}
          </p>
          <Link
            className="master-live-demo-link"
            params={{ moduleId: "manufacturers-models" }}
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
              {activeTab === "manufacturers" ? "Manufacturers" : "Models"}
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
              placeholder={
                activeTab === "manufacturers"
                  ? "Search manufacturer"
                  : "Search model or manufacturer"
              }
              value={search.search ?? ""}
            />
          </label>
          {isAdministrator && (
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
              Show inactive
            </label>
          )}
        </div>

        {activeQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(activeQuery.error)}
          </p>
        )}
        {activeQuery.isPending ? (
          <p className="master-live-state" role="status">
            Loading {activeTab}…
          </p>
        ) : activeQuery.isError ? null : activeQuery.data?.items.length ? (
          <div className="user-table-scroll">
            <table className="user-table master-live-table">
              <thead>
                <tr>
                  {activeTab === "manufacturers" ? (
                    <th scope="col">Manufacturer</th>
                  ) : (
                    <>
                      <th scope="col">Model</th>
                      <th scope="col">Manufacturer</th>
                    </>
                  )}
                  <th scope="col">Status</th>
                  <th scope="col">Version</th>
                  {isAdministrator && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {activeTab === "manufacturers"
                  ? manufacturersQuery.data?.items.map((record) => (
                      <tr key={record.id}>
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
                        {isAdministrator && (
                          <td>
                            <div className="user-row-actions">
                              <button
                                className="button button-secondary"
                                disabled={isMutating}
                                onClick={() => {
                                  setMessage(null);
                                  setLatestRecord(null);
                                  reset({
                                    name: record.name,
                                    manufacturerId: "",
                                  });
                                  setEditing({ kind: "manufacturer", record });
                                }}
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                className="button button-secondary"
                                disabled={isMutating}
                                onClick={() =>
                                  toggleActive({
                                    kind: "manufacturer",
                                    record,
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
                    ))
                  : modelsQuery.data?.items.map((record) => (
                      <tr key={record.id}>
                        <td>{record.name}</td>
                        <td>{record.manufacturer.name}</td>
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
                                  setLatestRecord(null);
                                  setManufacturerSearch(
                                    record.manufacturer.name,
                                  );
                                  setManufacturerPage(1);
                                  reset({
                                    name: record.name,
                                    manufacturerId: record.manufacturerId,
                                  });
                                  setEditing({ kind: "model", record });
                                }}
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                className="button button-secondary"
                                disabled={isMutating}
                                onClick={() =>
                                  toggleActive({ kind: "model", record })
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
              {activeTab === "manufacturers" ? "MF" : "MD"}
            </span>
            <div>
              <strong>
                {search.search
                  ? `No ${activeTab} match this search`
                  : `No active ${activeTab} yet`}
              </strong>
              <p>
                {isAdministrator
                  ? "Create the first reference using the form above."
                  : "No active organization references are available."}
              </p>
            </div>
          </div>
        )}

        {activeQuery.data && (
          <div className="asset-pagination" aria-label="Catalog pages">
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
