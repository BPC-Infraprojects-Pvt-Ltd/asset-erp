import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { canManageAssetCategories } from "./asset-access";
import {
  assetsApi,
  type AssetCategory,
  type CreateAssetCategoryInput,
} from "./assets-api";
import {
  assetCategoryEditError,
  type AssetCategoryEditError,
} from "./asset-category-edit-error";

const categorySchema = z
  .object({
    code: z.string().trim().min(1, "Enter a category code.").max(60),
    name: z.string().trim().min(1, "Enter a category name.").max(150),
    trackingMode: z.enum(["INDIVIDUAL", "QUANTITY"]),
    specificationFields: z
      .array(
        z.object({
          key: z
            .string()
            .trim()
            .toUpperCase()
            .regex(
              /^[A-Z][A-Z0-9_]{0,39}$/,
              "Use a unique key such as RAM_GB.",
            ),
          label: z.string().trim().min(1, "Enter a field label.").max(100),
          required: z.boolean(),
        }),
      )
      .max(20),
  })
  .superRefine((value, context) => {
    const keys = value.specificationFields.map((field) => field.key);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        message: "Specification keys must be unique.",
        path: ["specificationFields"],
      });
    }
  });

export function AssetCategoriesPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.session?.user.role);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(
    null,
  );
  const [editError, setEditError] = useState<AssetCategoryEditError | null>(
    null,
  );
  const [latestCategory, setLatestCategory] = useState<AssetCategory | null>(
    null,
  );
  const [isReviewingLatest, setIsReviewingLatest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: protectedQueryKey(
      "asset-categories",
      page,
      search,
      includeInactive,
    ),
    queryFn: () =>
      assetsApi.listCategories({
        page,
        pageSize: 20,
        search: search || undefined,
        includeInactive: includeInactive || undefined,
      }),
    enabled: canManageAssetCategories(role),
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateAssetCategoryInput>({
    defaultValues: {
      code: "",
      name: "",
      trackingMode: "INDIVIDUAL",
      specificationFields: [],
    },
  });
  const specificationFields = useFieldArray({
    control,
    name: "specificationFields",
  });

  const refreshCategories = async () => {
    await queryClient.invalidateQueries({
      queryKey: protectedQueryKey("asset-categories"),
    });
  };
  const createCategory = useMutation({
    mutationFn: assetsApi.createCategory,
    onSuccess: async () => {
      reset({
        code: "",
        name: "",
        trackingMode: "INDIVIDUAL",
        specificationFields: [],
      });
      setMessageIsError(false);
      setMessage("Asset category created.");
      setPage(1);
      await refreshCategories();
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });
  const updateCategory = useMutation({
    mutationFn: (input: CreateAssetCategoryInput) => {
      if (!editingCategory)
        throw new Error("No asset category is being edited.");
      return assetsApi.updateCategory(
        editingCategory.id,
        editingCategory.version,
        input,
      );
    },
    onSuccess: async () => {
      reset({
        code: "",
        name: "",
        trackingMode: "INDIVIDUAL",
        specificationFields: [],
      });
      setEditingCategory(null);
      setEditError(null);
      setLatestCategory(null);
      setMessageIsError(false);
      setMessage("Asset category updated.");
      await refreshCategories();
    },
    onError: (error) => {
      const result = assetCategoryEditError(error);
      setEditError(result.conflict || result.requiresReview ? result : null);
      setMessageIsError(true);
      setMessage(result.message);
    },
  });
  const updateCategoryStatus = useMutation({
    mutationFn: ({
      categoryId,
      isActive,
    }: {
      categoryId: string;
      isActive: boolean;
    }) => assetsApi.setCategoryActive(categoryId, isActive),
    onSuccess: async (category) => {
      setMessageIsError(false);
      setMessage(
        `Category ${category.code} ${category.isActive ? "reactivated" : "deactivated"}.`,
      );
      await refreshCategories();
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });
  const isMutating =
    createCategory.isPending ||
    updateCategory.isPending ||
    updateCategoryStatus.isPending;
  const submit = handleSubmit((values) => {
    setMessage(null);
    setMessageIsError(false);
    const parsed = categorySchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "code" || key === "name" || key === "trackingMode") {
          setError(key, { message: issue.message });
        } else if (key === "specificationFields") {
          setMessageIsError(true);
          setMessage(issue.message);
        }
      }
      return;
    }
    if (editingCategory) updateCategory.mutate(parsed.data);
    else createCategory.mutate(parsed.data);
  });

  async function reviewLatestCategory() {
    if (!editingCategory) return;
    setIsReviewingLatest(true);
    setLatestCategory(null);
    setMessage(null);
    try {
      const latest = await assetsApi.getCategory(editingCategory.id);
      setLatestCategory(latest);
      setMessageIsError(false);
      setMessage(
        latest.version === editingCategory.version
          ? "Latest category loaded. Your draft is kept; review the server values below before continuing."
          : "The category changed on the server. Your draft is kept; review the latest values below.",
      );
    } catch (error) {
      const result = assetCategoryEditError(error);
      const reviewMessage = `Could not verify the latest category. Your draft is kept. ${result.message}`;
      setEditError({
        conflict: false,
        requiresReview: true,
        message: reviewMessage,
      });
      setMessageIsError(true);
      setMessage(reviewMessage);
    } finally {
      setIsReviewingLatest(false);
    }
  }

  if (!canManageAssetCategories(role)) {
    return (
      <section>
        <div className="page-heading">
          <p className="eyebrow">Administration</p>
          <h1>Asset categories</h1>
          <p className="page-description">
            Asset categories are managed by Administrators.
          </p>
        </div>
        <p className="form-error" role="alert">
          Administrator access is required.
        </p>
      </section>
    );
  }

  return (
    <section className="master-live-page asset-categories-page">
      <div className="page-heading">
        <p className="eyebrow">Administration · Hardware setup</p>
        <h1>Hardware categories</h1>
        <p className="page-description">
          Define whether each hardware category is individually tracked or
          quantity tracked. Tracking mode is permanent; categories with
          historical references are deactivated, not deleted.
        </p>
      </div>

      <div className="master-live-layout asset-categories-layout">
        <section className="user-admin-card modern-form-card">
          <div className="form-card-heading">
            <span className="form-step-mark" aria-hidden="true">
              {editingCategory ? "ED" : "01"}
            </span>
            <div>
              <p className="eyebrow">Category definition</p>
              <h2>{editingCategory ? "Edit category" : "Create category"}</h2>
              <p>
                Choose tracking mode before creating a category. It cannot be
                changed later.
              </p>
            </div>
          </div>

          {message && (
            <p
              className={messageIsError ? "form-error" : "form-notice"}
              role={messageIsError ? "alert" : "status"}
            >
              {message}
            </p>
          )}
          {categoriesQuery.isError && (
            <p className="form-error" role="alert">
              {authErrorMessage(categoriesQuery.error)}
            </p>
          )}

          <form
            className="user-create-form modern-form"
            noValidate
            onSubmit={submit}
          >
            <div className="modern-form-grid master-live-form-grid">
              <div className="modern-field modern-field-wide">
                <label htmlFor="asset-category-code">Category code</label>
                <input
                  id="asset-category-code"
                  maxLength={60}
                  placeholder="e.g. LAPTOP"
                  {...register("code")}
                  aria-invalid={Boolean(errors.code)}
                />
                <small>Category codes are stored uppercase and unique.</small>
                {errors.code && (
                  <span className="field-error" role="alert">
                    {errors.code.message}
                  </span>
                )}
              </div>
              <div className="modern-field modern-field-wide">
                <label htmlFor="asset-category-tracking-mode">
                  Tracking mode
                </label>
                <select
                  id="asset-category-tracking-mode"
                  disabled={editingCategory !== null}
                  {...register("trackingMode")}
                >
                  <option value="INDIVIDUAL">
                    Individually tracked equipment
                  </option>
                  <option value="QUANTITY">
                    Quantity-tracked accessories and spares
                  </option>
                </select>
                {editingCategory && (
                  <small>Existing category tracking mode is immutable.</small>
                )}
              </div>
              <div className="modern-field modern-field-wide">
                <label htmlFor="asset-category-name">Category name</label>
                <input
                  id="asset-category-name"
                  maxLength={150}
                  placeholder="e.g. Laptop computer"
                  {...register("name")}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && (
                  <span className="field-error" role="alert">
                    {errors.name.message}
                  </span>
                )}
              </div>
            </div>

            <section className="asset-category-specification-editor">
              <div>
                <p className="eyebrow">Category-specific details</p>
                <p>
                  Define text fields required for this equipment type.
                  Specification keys are fixed after category creation.
                </p>
              </div>
              {specificationFields.fields.map((field, index) => (
                <div
                  className="asset-category-specification-row"
                  key={field.id}
                >
                  <label className="modern-field">
                    <span>Field key</span>
                    <input
                      disabled={editingCategory !== null}
                      maxLength={40}
                      placeholder="e.g. RAM_GB"
                      {...register(`specificationFields.${index}.key`)}
                    />
                    {errors.specificationFields?.[index]?.key && (
                      <span className="field-error" role="alert">
                        {errors.specificationFields[index]?.key?.message}
                      </span>
                    )}
                  </label>
                  <label className="modern-field">
                    <span>Label</span>
                    <input
                      disabled={editingCategory !== null}
                      maxLength={100}
                      placeholder="e.g. Memory"
                      {...register(`specificationFields.${index}.label`)}
                    />
                    {errors.specificationFields?.[index]?.label && (
                      <span className="field-error" role="alert">
                        {errors.specificationFields[index]?.label?.message}
                      </span>
                    )}
                  </label>
                  <label className="asset-category-required-field">
                    <input
                      disabled={editingCategory !== null}
                      type="checkbox"
                      {...register(`specificationFields.${index}.required`)}
                    />
                    Required
                  </label>
                  {editingCategory === null && (
                    <button
                      className="button button-secondary"
                      onClick={() => specificationFields.remove(index)}
                      type="button"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {errors.specificationFields?.message && (
                <p className="field-error" role="alert">
                  {errors.specificationFields.message}
                </p>
              )}
              {editingCategory === null && (
                <button
                  className="button button-secondary asset-category-add-field"
                  disabled={specificationFields.fields.length >= 20}
                  onClick={() =>
                    specificationFields.append({
                      key: "",
                      label: "",
                      required: false,
                    })
                  }
                  type="button"
                >
                  Add specification field
                </button>
              )}
              {editingCategory && (
                <small>
                  Existing specification fields are immutable so stored asset
                  values keep their meaning.
                </small>
              )}
            </section>

            {editingCategory &&
              (editError?.conflict || editError?.requiresReview) && (
                <div className="master-live-conflict-actions">
                  <p>{editError.message}</p>
                  <button
                    className="button button-secondary"
                    disabled={isReviewingLatest || updateCategory.isPending}
                    onClick={() => void reviewLatestCategory()}
                    type="button"
                  >
                    {isReviewingLatest
                      ? "Loading latest…"
                      : "Load latest for review"}
                  </button>
                </div>
              )}

            {editingCategory && latestCategory && (
              <section className="master-live-conflict-review">
                <div>
                  <p className="eyebrow">Latest server version</p>
                  <h3>
                    Version {latestCategory.version} ·{" "}
                    {latestCategory.isActive ? "Active" : "Inactive"}
                  </h3>
                </div>
                <dl>
                  <div>
                    <dt>Code</dt>
                    <dd>{latestCategory.code}</dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>{latestCategory.name}</dd>
                  </div>
                  <div>
                    <dt>Tracking mode</dt>
                    <dd>{latestCategory.trackingMode.replaceAll("_", " ")}</dd>
                  </div>
                  <div>
                    <dt>Specification fields</dt>
                    <dd>
                      {latestCategory.specificationFields
                        .map((field) => field.key)
                        .join(", ") || "None"}
                    </dd>
                  </div>
                </dl>
                <button
                  className="button button-secondary"
                  disabled={isReviewingLatest || updateCategory.isPending}
                  onClick={() => {
                    reset({
                      code: latestCategory.code,
                      name: latestCategory.name,
                      trackingMode: latestCategory.trackingMode,
                      specificationFields: latestCategory.specificationFields,
                    });
                    setEditingCategory(latestCategory);
                    setEditError(null);
                    setLatestCategory(null);
                    setMessage(null);
                  }}
                  type="button"
                >
                  Discard draft and edit latest version
                </button>
              </section>
            )}

            <div className="modern-form-actions master-live-form-actions">
              <div>
                <strong>
                  {editingCategory
                    ? `Saving version ${editingCategory.version}`
                    : "Organization-scoped master data"}
                </strong>
                <small>
                  Changes apply to the category reference, not existing assets.
                </small>
              </div>
              <div className="user-form-actions">
                <button
                  className="button"
                  disabled={
                    isMutating ||
                    editError?.conflict ||
                    editError?.requiresReview
                  }
                  type="submit"
                >
                  {updateCategory.isPending
                    ? "Saving…"
                    : createCategory.isPending
                      ? "Creating…"
                      : editingCategory
                        ? "Save changes"
                        : "Create category"}
                </button>
                {editingCategory && (
                  <button
                    className="button button-secondary"
                    disabled={isMutating || isReviewingLatest}
                    onClick={() => {
                      reset({
                        code: "",
                        name: "",
                        trackingMode: "INDIVIDUAL",
                        specificationFields: [],
                      });
                      setEditingCategory(null);
                      setLatestCategory(null);
                      setEditError(null);
                      setMessage(null);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>

        <aside className="master-live-aside">
          <p className="eyebrow">Asset registration</p>
          <h2>Tracking mode drives the workflow</h2>
          <p>
            Individual categories appear in asset registration. Quantity
            categories are used by the Accessories &amp; Spare Stock ledger.
            Stock balances come from transactions, not editable totals.
          </p>
        </aside>
      </div>

      <section className="user-admin-card master-live-list-card">
        <div className="master-live-list-heading">
          <div>
            <p className="eyebrow">Organization master</p>
            <h2>Category list</h2>
          </div>
          {categoriesQuery.data && (
            <span className="master-live-total">
              {categoriesQuery.data.total} total
            </span>
          )}
        </div>
        <div className="master-live-toolbar">
          <label className="master-live-search">
            <span>Search categories</span>
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search code or name"
              value={search}
            />
          </label>
          <label className="asset-category-inactive-toggle">
            <input
              checked={includeInactive}
              onChange={(event) => {
                setIncludeInactive(event.target.checked);
                setPage(1);
              }}
              type="checkbox"
            />
            Show inactive
          </label>
        </div>
        {categoriesQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(categoriesQuery.error)}
          </p>
        )}
        {categoriesQuery.isPending ? (
          <p className="master-live-state" role="status">
            Loading asset categories…
          </p>
        ) : categoriesQuery.isError ? null : categoriesQuery.data?.items
            .length ? (
          <div className="user-table-scroll">
            <table className="user-table master-live-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Category name</th>
                  <th scope="col">Tracking mode</th>
                  <th scope="col">Specifications</th>
                  <th scope="col">Status</th>
                  <th scope="col">Version</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categoriesQuery.data.items.map((category) => (
                  <tr key={category.id}>
                    <td className="master-live-code">{category.code}</td>
                    <td>{category.name}</td>
                    <td>{category.trackingMode.replaceAll("_", " ")}</td>
                    <td>{category.specificationFields.length}</td>
                    <td>
                      <span
                        className={
                          category.isActive
                            ? "master-live-status active"
                            : "master-live-status inactive"
                        }
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{category.version}</td>
                    <td>
                      <div className="user-row-actions">
                        <button
                          className="button button-secondary"
                          disabled={isMutating || editingCategory !== null}
                          onClick={() => {
                            reset({
                              code: category.code,
                              name: category.name,
                              trackingMode: category.trackingMode,
                              specificationFields: category.specificationFields,
                            });
                            setEditingCategory(category);
                            setLatestCategory(null);
                            setEditError(null);
                            setMessage(null);
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="button button-secondary"
                          disabled={isMutating}
                          onClick={() =>
                            updateCategoryStatus.mutate({
                              categoryId: category.id,
                              isActive: !category.isActive,
                            })
                          }
                          type="button"
                        >
                          {category.isActive ? "Deactivate" : "Reactivate"}
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
              AC
            </span>
            <div>
              <strong>
                {search
                  ? "No categories match this search."
                  : includeInactive
                    ? "No categories have been created."
                    : "No active asset categories."}
              </strong>
              <p>Create a category to enable its tracking-specific workflow.</p>
            </div>
          </div>
        )}
        {categoriesQuery.data && (
          <div className="asset-pagination" aria-label="Asset category pages">
            <span>
              Page {categoriesQuery.data.page} of{" "}
              {Math.max(
                1,
                Math.ceil(
                  categoriesQuery.data.total / categoriesQuery.data.pageSize,
                ),
              )}
            </span>
            <button
              className="button button-secondary"
              disabled={page <= 1 || categoriesQuery.isFetching}
              onClick={() => setPage((current) => current - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="button button-secondary"
              disabled={
                categoriesQuery.isFetching ||
                page >=
                  Math.max(
                    1,
                    Math.ceil(
                      categoriesQuery.data.total /
                        categoriesQuery.data.pageSize,
                    ),
                  )
              }
              onClick={() => setPage((current) => current + 1)}
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
