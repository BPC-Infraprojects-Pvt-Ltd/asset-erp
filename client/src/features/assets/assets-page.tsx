import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { locationsApi } from "../locations/locations-api";
import {
  assetsApi,
  type AssetAvailability,
  type AssetCondition,
  type AssetLifecycle,
  type AssetVerification,
  type AssetCategory,
  type CreateAssetCategoryInput,
  type CreateAssetInput,
} from "./assets-api";
import type { AssetListSearch } from "./asset-list-search";
import { Route } from "../../routes/assets";
import {
  assetCategoryEditError,
  type AssetCategoryEditError,
} from "./asset-category-edit-error";

const categorySchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(150),
});

const assetSchema = z
  .object({
    assetTag: z.string().trim().min(1).max(100),
    categoryId: z.string().uuid(),
    locationId: z.string().uuid(),
    availability: z.enum(["AVAILABLE", "QUARANTINED", "UNAVAILABLE"]),
    condition: z.enum([
      "NEW",
      "GOOD",
      "FAIR",
      "DAMAGED",
      "NONFUNCTIONAL",
      "UNKNOWN",
    ]),
    manufacturer: z.string().trim().max(150),
    model: z.string().trim().max(150),
    serialNumber: z.string().trim().max(150),
    sourceReference: z.string().trim().max(150),
    notes: z.string().trim().max(2000),
  })
  .refine(
    (value) =>
      value.condition !== "NONFUNCTIONAL" ||
      ["QUARANTINED", "UNAVAILABLE"].includes(value.availability),
    {
      message: "Nonfunctional assets must be quarantined or unavailable.",
      path: ["availability"],
    },
  );

const availabilityOptions: { value: AssetAvailability; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "QUARANTINED", label: "Quarantined" },
  { value: "UNAVAILABLE", label: "Unavailable" },
];
const conditionOptions: { value: AssetCondition; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "NONFUNCTIONAL", label: "Nonfunctional" },
  { value: "UNKNOWN", label: "Unknown" },
];
const verificationOptions: { value: AssetVerification; label: string }[] = [
  { value: "VERIFIED", label: "Verified" },
  { value: "MISSING", label: "Missing" },
  { value: "DISPUTED", label: "Disputed" },
  { value: "NOT_CHECKED", label: "Not checked" },
];
const lifecycleOptions: { value: AssetLifecycle; label: string }[] = [
  { value: "RECEIVED", label: "Received" },
  { value: "ACTIVE", label: "Active" },
  { value: "RETIRED", label: "Retired" },
  { value: "DISPOSED", label: "Disposed" },
];
const filterAvailabilityOptions: { value: AssetAvailability; label: string }[] =
  [
    ...availabilityOptions,
    { value: "RESERVED", label: "Reserved" },
    { value: "ASSIGNED", label: "Assigned" },
    { value: "IN_TRANSIT", label: "In transit" },
    { value: "IN_REPAIR", label: "In repair" },
  ];

export function AssetsPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.session?.user.role);
  const isAdministrator = role === "ADMINISTRATOR";
  const isAssetManager = role === "ASSET_MANAGER";
  const navigate = useNavigate({ from: "/assets" });
  const {
    page,
    search,
    locationId,
    categoryId,
    lifecycle,
    availability,
    condition,
    verification,
  } = Route.useSearch();
  const [categoryPage, setCategoryPage] = useState(1);
  const [categorySearch, setCategorySearch] = useState("");
  const [includeInactiveCategories, setIncludeInactiveCategories] =
    useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(
    null,
  );
  const [categoryEditError, setCategoryEditError] =
    useState<AssetCategoryEditError | null>(null);
  const [latestCategory, setLatestCategory] = useState<AssetCategory | null>(
    null,
  );
  const [reviewingCategory, setReviewingCategory] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateListSearch(updates: Partial<AssetListSearch>) {
    void navigate({
      search: (current) => ({ ...current, ...updates }),
    });
  }

  const categoriesQuery = useQuery({
    queryKey: protectedQueryKey(
      "asset-categories",
      categoryPage,
      categorySearch,
      isAdministrator && includeInactiveCategories,
    ),
    queryFn: () =>
      assetsApi.listCategories({
        page: categoryPage,
        pageSize: 20,
        search: categorySearch || undefined,
        includeInactive:
          (isAdministrator && includeInactiveCategories) || undefined,
      }),
    enabled: isAdministrator || isAssetManager,
  });
  const locationsQuery = useQuery({
    queryKey: protectedQueryKey("locations"),
    queryFn: locationsApi.list,
    enabled: isAssetManager,
  });
  const assetsQuery = useQuery({
    queryKey: protectedQueryKey(
      "assets",
      page,
      search,
      locationId,
      categoryId,
      lifecycle,
      availability,
      condition,
      verification,
    ),
    queryFn: () =>
      assetsApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        locationId: locationId || undefined,
        categoryId: categoryId || undefined,
        lifecycle: (lifecycle || undefined) as AssetLifecycle | undefined,
        availability: (availability || undefined) as
          AssetAvailability | undefined,
        condition: (condition || undefined) as AssetCondition | undefined,
        verification: (verification || undefined) as
          AssetVerification | undefined,
      }),
    enabled: isAssetManager,
  });
  const createCategory = useMutation({
    mutationFn: assetsApi.createCategory,
    onSuccess: async () => {
      resetCategory();
      setMessage(null);
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("asset-categories"),
      });
    },
    onError: (error) => setMessage(authErrorMessage(error)),
  });
  const updateCategoryStatus = useMutation({
    mutationFn: ({
      categoryId,
      isActive,
    }: {
      categoryId: string;
      isActive: boolean;
    }) => assetsApi.setCategoryActive(categoryId, isActive),
    onSuccess: async () => {
      if (editingCategory) {
        resetCategory({
          code: editingCategory.code,
          name: editingCategory.name,
        });
      } else {
        resetCategory({ code: "", name: "" });
      }
      setMessage(null);
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("asset-categories"),
      });
    },
    onError: (error) => setMessage(authErrorMessage(error)),
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
      resetCategory();
      setEditingCategory(null);
      setCategoryEditError(null);
      setLatestCategory(null);
      setMessage(null);
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("asset-categories"),
      });
    },
    onError: (error) => {
      const editError = assetCategoryEditError(error);
      setCategoryEditError(
        editError.conflict || editError.requiresReview ? editError : null,
      );
      setMessage(editError.message);
    },
  });
  const createAsset = useMutation({
    mutationFn: assetsApi.create,
    onSuccess: async () => {
      resetAsset();
      setMessage(null);
      updateListSearch({ page: 1 });
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("assets"),
      });
    },
    onError: (error) => setMessage(authErrorMessage(error)),
  });
  const {
    register: registerCategory,
    handleSubmit: handleCategorySubmit,
    reset: resetCategory,
    formState: { errors: categoryErrors },
  } = useForm<CreateAssetCategoryInput>({
    defaultValues: { code: "", name: "" },
  });
  const {
    register: registerAsset,
    handleSubmit: handleAssetSubmit,
    reset: resetAsset,
    setValue: setAssetValue,
    watch: watchAsset,
    formState: { errors: assetErrors },
  } = useForm<CreateAssetInput>({
    defaultValues: {
      assetTag: "",
      categoryId: "",
      locationId: "",
      availability: "AVAILABLE",
      condition: "GOOD",
      manufacturer: "",
      model: "",
      serialNumber: "",
      sourceReference: "",
      notes: "",
    },
  });
  const selectedAvailability = watchAsset("availability");
  const selectedCondition = watchAsset("condition");
  const serialNumber = watchAsset("serialNumber") ?? "";
  const [checkedSerialNumber, setCheckedSerialNumber] = useState("");

  useEffect(() => {
    const serial = serialNumber.trim();
    if (!serial) {
      setCheckedSerialNumber("");
      return;
    }
    const timeout = window.setTimeout(
      () => setCheckedSerialNumber(serial),
      350,
    );
    return () => window.clearTimeout(timeout);
  }, [serialNumber]);

  const serialMatchesQuery = useQuery({
    queryKey: protectedQueryKey("asset-serial-matches", checkedSerialNumber),
    queryFn: () =>
      assetsApi.list({
        page: 1,
        pageSize: 5,
        serialNumberExact: checkedSerialNumber,
      }),
    enabled: isAssetManager && checkedSerialNumber.length > 0,
  });

  const submitCategory = handleCategorySubmit((values) => {
    setMessage(null);
    const parsed = categorySchema.safeParse(values);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Invalid category.");
      return;
    }
    if (editingCategory) updateCategory.mutate(parsed.data);
    else createCategory.mutate(parsed.data);
  });
  const submitAsset = handleAssetSubmit((values) => {
    setMessage(null);
    const parsed = assetSchema.safeParse(values);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Invalid asset.");
      return;
    }
    const {
      manufacturer,
      model,
      serialNumber,
      sourceReference,
      notes,
      ...rest
    } = parsed.data;
    createAsset.mutate({
      ...rest,
      manufacturer: manufacturer || undefined,
      model: model || undefined,
      serialNumber: serialNumber || undefined,
      sourceReference: sourceReference || undefined,
      notes: notes || undefined,
    });
  });

  async function reviewLatestCategory() {
    if (!editingCategory) return;
    setReviewingCategory(true);
    setLatestCategory(null);
    setMessage(null);
    try {
      const latest = await assetsApi.getCategory(editingCategory.id);
      setLatestCategory(latest);
      setMessage(
        latest.version === editingCategory.version
          ? "Latest category loaded. Your draft is kept; review the server values below before continuing."
          : "The category changed on the server. Your draft is kept; review the latest values below.",
      );
    } catch (error) {
      const reviewError = assetCategoryEditError(error);
      const message = `Could not verify the latest category. Your draft is kept. ${reviewError.message}`;
      setCategoryEditError({
        conflict: false,
        requiresReview: true,
        message,
      });
      setMessage(message);
    } finally {
      setReviewingCategory(false);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Hardware</p>
        <h1>Asset register</h1>
        <p className="page-description">
          Register individually tracked equipment within your assigned location
          scope. New records are created as received; later lifecycle changes
          require their own approved workflows.
        </p>
      </div>

      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}

      {isAdministrator && (
        <section className="user-admin-card" aria-labelledby="create-category">
          <h2 id="create-category">Asset categories</h2>
          <p>
            Maintain the organization category list available to Asset Managers.
          </p>
          {categoriesQuery.isError && (
            <p className="form-error" role="alert">
              {authErrorMessage(categoriesQuery.error)}
            </p>
          )}
          <form className="user-create-form" onSubmit={submitCategory}>
            <label htmlFor="asset-category-code">Code</label>
            <input
              id="asset-category-code"
              maxLength={60}
              {...registerCategory("code")}
            />
            {categoryErrors.code && (
              <span className="field-error">{categoryErrors.code.message}</span>
            )}
            <label htmlFor="asset-category-name">Name</label>
            <input
              id="asset-category-name"
              maxLength={150}
              {...registerCategory("name")}
            />
            {categoryErrors.name && (
              <span className="field-error">{categoryErrors.name.message}</span>
            )}
            <button
              className="button"
              disabled={
                createCategory.isPending ||
                updateCategory.isPending ||
                reviewingCategory ||
                categoryEditError?.conflict ||
                categoryEditError?.requiresReview
              }
              type="submit"
            >
              {updateCategory.isPending
                ? "Saving…"
                : editingCategory
                  ? "Save category"
                  : createCategory.isPending
                    ? "Creating…"
                    : "Create category"}
            </button>
            {editingCategory && (
              <button
                className="button button-secondary"
                disabled={updateCategory.isPending || reviewingCategory}
                onClick={() => {
                  resetCategory({ code: "", name: "" });
                  setEditingCategory(null);
                  setCategoryEditError(null);
                  setLatestCategory(null);
                  setMessage(null);
                }}
                type="button"
              >
                Cancel edit
              </button>
            )}
          </form>
          {editingCategory &&
            (categoryEditError?.conflict ||
              categoryEditError?.requiresReview) && (
              <div className="asset-category-conflict">
                <button
                  className="button button-secondary"
                  disabled={reviewingCategory || updateCategory.isPending}
                  onClick={() => void reviewLatestCategory()}
                  type="button"
                >
                  {reviewingCategory
                    ? "Loading latest…"
                    : "Load latest for review (keep draft)"}
                </button>
                {latestCategory && (
                  <section aria-label="Latest server category">
                    <h3>Latest category — version {latestCategory.version}</h3>
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
                        <dt>Status</dt>
                        <dd>
                          {latestCategory.isActive ? "Active" : "Inactive"}
                        </dd>
                      </div>
                    </dl>
                    <button
                      className="button"
                      disabled={reviewingCategory || updateCategory.isPending}
                      onClick={() => {
                        resetCategory({
                          code: latestCategory.code,
                          name: latestCategory.name,
                        });
                        setEditingCategory(latestCategory);
                        setCategoryEditError(null);
                        setLatestCategory(null);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      Discard my draft and edit latest version
                    </button>
                  </section>
                )}
              </div>
            )}
          <label className="asset-category-search">
            Search categories
            <input
              onChange={(event) => {
                setCategorySearch(event.target.value);
                setCategoryPage(1);
              }}
              value={categorySearch}
            />
          </label>
          <label className="asset-category-inactive-toggle">
            <input
              checked={includeInactiveCategories}
              onChange={(event) => {
                setIncludeInactiveCategories(event.target.checked);
                setCategoryPage(1);
              }}
              type="checkbox"
            />
            Show inactive categories
          </label>
          {categoriesQuery.data?.items.length ? (
            <ul className="master-list">
              {categoriesQuery.data.items.map((category) => (
                <li key={category.id}>
                  <div className="asset-category-row">
                    <span>
                      <strong>{category.code}</strong> — {category.name} (
                      {category.isActive ? "Active" : "Inactive"})
                    </span>
                    <button
                      className="button button-secondary"
                      disabled={
                        updateCategory.isPending ||
                        createCategory.isPending ||
                        updateCategoryStatus.isPending ||
                        editingCategory !== null
                      }
                      onClick={() => {
                        resetCategory({
                          code: category.code,
                          name: category.name,
                        });
                        setEditingCategory(category);
                        setCategoryEditError(null);
                        setLatestCategory(null);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="button button-secondary"
                      disabled={updateCategoryStatus.isPending}
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
                </li>
              ))}
            </ul>
          ) : (
            !categoriesQuery.isPending && <p>No asset categories yet.</p>
          )}
          {categoriesQuery.data && (
            <div className="asset-pagination" aria-label="Category pages">
              <span>
                {categoriesQuery.data.total} total · Page{" "}
                {categoriesQuery.data.page} of{" "}
                {Math.max(
                  1,
                  Math.ceil(
                    categoriesQuery.data.total / categoriesQuery.data.pageSize,
                  ),
                )}
              </span>
              <button
                className="button button-secondary"
                disabled={categoryPage <= 1 || categoriesQuery.isFetching}
                onClick={() => setCategoryPage((current) => current - 1)}
                type="button"
              >
                Previous
              </button>
              <button
                className="button button-secondary"
                disabled={
                  categoriesQuery.isFetching ||
                  categoryPage * categoriesQuery.data.pageSize >=
                    categoriesQuery.data.total
                }
                onClick={() => setCategoryPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {isAssetManager && (
        <>
          <section className="user-admin-card" aria-labelledby="register-asset">
            <h2 id="register-asset">Register received asset</h2>
            {categoriesQuery.isError && (
              <p className="form-error" role="alert">
                {authErrorMessage(categoriesQuery.error)}
              </p>
            )}
            {locationsQuery.isError && (
              <p className="form-error" role="alert">
                {authErrorMessage(locationsQuery.error)}
              </p>
            )}
            <form className="user-create-form" onSubmit={submitAsset}>
              <label htmlFor="asset-tag">Asset tag</label>
              <input id="asset-tag" {...registerAsset("assetTag")} />
              {assetErrors.assetTag && (
                <span className="field-error">
                  {assetErrors.assetTag.message}
                </span>
              )}
              <label htmlFor="asset-category-search">Find category</label>
              <input
                id="asset-category-search"
                onChange={(event) => {
                  setCategorySearch(event.target.value);
                  setCategoryPage(1);
                  setAssetValue("categoryId", "");
                }}
                value={categorySearch}
              />
              <label htmlFor="asset-category">Category</label>
              <select id="asset-category" {...registerAsset("categoryId")}>
                <option value="">Select a category</option>
                {categoriesQuery.data?.items
                  .filter((category) => category.isActive)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.code} — {category.name}
                    </option>
                  ))}
              </select>
              {categoriesQuery.data && (
                <div className="asset-pagination" aria-label="Category choices">
                  <button
                    className="button button-secondary"
                    disabled={categoryPage <= 1 || categoriesQuery.isFetching}
                    onClick={() => {
                      setCategoryPage((current) => current - 1);
                      setAssetValue("categoryId", "");
                    }}
                    type="button"
                  >
                    Previous categories
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={
                      categoriesQuery.isFetching ||
                      categoryPage * categoriesQuery.data.pageSize >=
                        categoriesQuery.data.total
                    }
                    onClick={() => {
                      setCategoryPage((current) => current + 1);
                      setAssetValue("categoryId", "");
                    }}
                    type="button"
                  >
                    More categories
                  </button>
                </div>
              )}
              {assetErrors.categoryId && (
                <span className="field-error">
                  {assetErrors.categoryId.message}
                </span>
              )}
              <label htmlFor="asset-location">Confirmed location</label>
              <select id="asset-location" {...registerAsset("locationId")}>
                <option value="">Select a location</option>
                {locationsQuery.data?.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} — {location.name}
                  </option>
                ))}
              </select>
              {assetErrors.locationId && (
                <span className="field-error">
                  {assetErrors.locationId.message}
                </span>
              )}
              <label htmlFor="asset-availability">Initial availability</label>
              <select
                id="asset-availability"
                {...registerAsset("availability")}
              >
                {availabilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {assetErrors.availability && (
                <span className="field-error">
                  {assetErrors.availability.message}
                </span>
              )}
              <label htmlFor="asset-condition">Condition</label>
              <select id="asset-condition" {...registerAsset("condition")}>
                {conditionOptions.map((option) => (
                  <option
                    key={option.value}
                    disabled={
                      option.value === "NONFUNCTIONAL" &&
                      selectedAvailability === "AVAILABLE"
                    }
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              {assetErrors.condition && (
                <span className="field-error">
                  {assetErrors.condition.message}
                </span>
              )}
              {selectedCondition === "NONFUNCTIONAL" &&
                selectedAvailability === "AVAILABLE" && (
                  <span className="field-error">
                    Choose quarantined or unavailable for a nonfunctional asset.
                  </span>
                )}
              <label htmlFor="asset-manufacturer">Manufacturer</label>
              <input
                id="asset-manufacturer"
                {...registerAsset("manufacturer")}
              />
              <label htmlFor="asset-model">Model</label>
              <input id="asset-model" {...registerAsset("model")} />
              <label htmlFor="asset-serial">Serial number</label>
              <input id="asset-serial" {...registerAsset("serialNumber")} />
              {serialNumber.trim().length > 0 && (
                <div className="asset-serial-check">
                  {serialMatchesQuery.isFetching ? (
                    <p role="status">Checking accessible assets…</p>
                  ) : serialMatchesQuery.isError ? (
                    <p className="form-error" role="alert">
                      Could not check for matching serial numbers. Registration
                      is still available; verify the serial number manually.
                    </p>
                  ) : checkedSerialNumber === serialNumber.trim() &&
                    serialMatchesQuery.data ? (
                    serialMatchesQuery.data.total > 0 ? (
                      <div role="status">
                        <p>
                          {serialMatchesQuery.data.total} existing asset
                          {serialMatchesQuery.data.total === 1 ? "" : "s"} in
                          your accessible locations{" "}
                          {serialMatchesQuery.data.total === 1 ? "has" : "have"}{" "}
                          this exact serial number. Serial numbers are not
                          unique; review for a possible duplicate.
                        </p>
                        <ul>
                          {serialMatchesQuery.data.items.map((asset) => (
                            <li key={asset.id}>
                              {asset.assetTag} — {asset.category.name} —{" "}
                              {asset.location.code} ({asset.location.name})
                            </li>
                          ))}
                        </ul>
                        {serialMatchesQuery.data.total >
                          serialMatchesQuery.data.items.length && (
                          <p>
                            Showing {serialMatchesQuery.data.items.length} of{" "}
                            {serialMatchesQuery.data.total} matches.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p role="status">
                        No exact serial-number matches in your accessible
                        locations.
                      </p>
                    )
                  ) : (
                    <p role="status">
                      Checking for exact serial-number matches…
                    </p>
                  )}
                </div>
              )}
              <label htmlFor="asset-source">Source reference (optional)</label>
              <input id="asset-source" {...registerAsset("sourceReference")} />
              <label htmlFor="asset-notes">Notes (optional)</label>
              <textarea id="asset-notes" {...registerAsset("notes")} />
              <button
                className="button"
                disabled={
                  createAsset.isPending ||
                  !categoriesQuery.data?.items.length ||
                  !locationsQuery.data?.length
                }
                type="submit"
              >
                {createAsset.isPending ? "Registering…" : "Register asset"}
              </button>
            </form>
          </section>

          <section className="user-admin-card" aria-labelledby="asset-list">
            <h2 id="asset-list">Registered assets</h2>
            <div className="asset-filters">
              <label>
                Search
                <input
                  onChange={(event) => {
                    updateListSearch({ search: event.target.value, page: 1 });
                  }}
                  value={search}
                />
              </label>
              <label>
                Location
                <select
                  onChange={(event) => {
                    updateListSearch({
                      locationId: event.target.value,
                      page: 1,
                    });
                  }}
                  value={locationId}
                >
                  <option value="">All assigned locations</option>
                  {locationsQuery.data?.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} — {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <select
                  onChange={(event) => {
                    updateListSearch({
                      categoryId: event.target.value,
                      page: 1,
                    });
                  }}
                  value={categoryId}
                >
                  <option value="">All categories</option>
                  {categoriesQuery.data?.items.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lifecycle
                <select
                  onChange={(event) => {
                    updateListSearch({
                      lifecycle: event.target
                        .value as AssetListSearch["lifecycle"],
                      page: 1,
                    });
                  }}
                  value={lifecycle}
                >
                  <option value="">All lifecycle states</option>
                  {lifecycleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Availability
                <select
                  onChange={(event) => {
                    updateListSearch({
                      availability: event.target
                        .value as AssetListSearch["availability"],
                      page: 1,
                    });
                  }}
                  value={availability}
                >
                  <option value="">All availability states</option>
                  {filterAvailabilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Condition
                <select
                  onChange={(event) => {
                    updateListSearch({
                      condition: event.target
                        .value as AssetListSearch["condition"],
                      page: 1,
                    });
                  }}
                  value={condition}
                >
                  <option value="">All conditions</option>
                  {conditionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Verification
                <select
                  onChange={(event) => {
                    updateListSearch({
                      verification: event.target
                        .value as AssetListSearch["verification"],
                      page: 1,
                    });
                  }}
                  value={verification}
                >
                  <option value="">All verification states</option>
                  {verificationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="button button-secondary"
              onClick={() => {
                updateListSearch({
                  search: "",
                  locationId: "",
                  categoryId: "",
                  lifecycle: "",
                  availability: "",
                  condition: "",
                  verification: "",
                  page: 1,
                });
              }}
              type="button"
            >
              Reset filters
            </button>

            {assetsQuery.isError && (
              <p className="form-error" role="alert">
                {authErrorMessage(assetsQuery.error)}
              </p>
            )}
            {assetsQuery.isFetching && !assetsQuery.isPending && (
              <p role="status">Refreshing assets…</p>
            )}
            {assetsQuery.isPending ? (
              <p role="status">Loading assets…</p>
            ) : assetsQuery.data?.items.length ? (
              <>
                <div className="user-table-scroll">
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Asset tag</th>
                        <th>Category</th>
                        <th>Serial number</th>
                        <th>Location</th>
                        <th>Lifecycle</th>
                        <th>Availability</th>
                        <th>Condition</th>
                        <th>Verification</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetsQuery.data.items.map((asset) => (
                        <tr key={asset.id}>
                          <td>{asset.assetTag}</td>
                          <td>{asset.category.name}</td>
                          <td>{asset.serialNumber ?? "—"}</td>
                          <td>
                            {asset.location.code} — {asset.location.name}
                          </td>
                          <td>{asset.lifecycle}</td>
                          <td>{asset.availability.replaceAll("_", " ")}</td>
                          <td>{asset.condition}</td>
                          <td>{asset.verification.replaceAll("_", " ")}</td>
                          <td>
                            <Link
                              params={{ assetId: asset.id }}
                              search={(current) => ({
                                page: current.page ?? 1,
                                search: current.search ?? "",
                                locationId: current.locationId ?? "",
                                categoryId: current.categoryId ?? "",
                                lifecycle: current.lifecycle ?? "",
                                availability: current.availability ?? "",
                                condition: current.condition ?? "",
                                verification: current.verification ?? "",
                              })}
                              to="/assets/$assetId"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="asset-pagination" aria-label="Asset pages">
                  <span>
                    {assetsQuery.data.total} total · Page{" "}
                    {assetsQuery.data.page} of{" "}
                    {Math.max(
                      1,
                      Math.ceil(
                        assetsQuery.data.total / assetsQuery.data.pageSize,
                      ),
                    )}
                  </span>
                  <button
                    className="button button-secondary"
                    disabled={page <= 1 || assetsQuery.isFetching}
                    onClick={() => updateListSearch({ page: page - 1 })}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={
                      assetsQuery.isFetching ||
                      page * assetsQuery.data.pageSize >= assetsQuery.data.total
                    }
                    onClick={() => updateListSearch({ page: page + 1 })}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : assetsQuery.isError ? null : (
              <p>No assets match the current filters.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
