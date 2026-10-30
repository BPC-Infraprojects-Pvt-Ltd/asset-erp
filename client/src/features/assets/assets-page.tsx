import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { locationsApi } from "../locations/locations-api";
import { canManageAssetRegister, canViewAssetRegister } from "./asset-access";
import {
  assetsApi,
  type AssetCriticality,
  type AssetAvailability,
  type AssetCondition,
  type AssetLifecycle,
  type AssetVerification,
  type CreateAssetInput,
} from "./assets-api";
import {
  assetIdFromScannedCode,
  type AssetListSearch,
} from "./asset-list-search";
import { Route } from "../../routes/assets";

type AssetRegistrationFormInput = Omit<CreateAssetInput, "criticality"> & {
  criticality: AssetCriticality | "";
};

const optionalDate = z.string().refine((value) => {
  if (!value) return true;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}, "Enter a valid calendar date.");

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
    criticality: z.enum(["", "LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    manufacturer: z.string().trim().max(150),
    model: z.string().trim().max(150),
    serialNumber: z.string().trim().max(150),
    sourceReference: z.string().trim().max(150),
    notes: z.string().trim().max(2000),
    specifications: z.record(z.string(), z.string()),
    purchaseDate: optionalDate,
    warrantyExpiresOn: optionalDate,
    warrantyReference: z.string().trim().max(150),
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
  const pathname = useLocation({ select: (location) => location.pathname });

  return pathname === "/assets" ? <AssetRegisterPage /> : <Outlet />;
}

function AssetRegisterPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.session?.user.role);
  const canManageAssets = canManageAssetRegister(role);
  const canViewAssets = canViewAssetRegister(role);
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
    warrantyExpiresOnFrom,
    warrantyExpiresOnTo,
  } = Route.useSearch();
  const [categoryPage, setCategoryPage] = useState(1);
  const [categorySearch, setCategorySearch] = useState("");
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
    ),
    queryFn: () =>
      assetsApi.listCategories({
        page: categoryPage,
        pageSize: 20,
        search: categorySearch || undefined,
        trackingMode: "INDIVIDUAL",
      }),
    enabled: canViewAssets,
  });
  const locationsQuery = useQuery({
    queryKey: protectedQueryKey("locations"),
    queryFn: locationsApi.list,
    enabled: canViewAssets,
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
      warrantyExpiresOnFrom,
      warrantyExpiresOnTo,
    ),
    queryFn: () =>
      assetsApi.list({
        page,
        pageSize: 20,
        search: assetIdFromScannedCode(search)
          ? undefined
          : search || undefined,
        assetIdExact: assetIdFromScannedCode(search),
        locationId: locationId || undefined,
        categoryId: categoryId || undefined,
        lifecycle: (lifecycle || undefined) as AssetLifecycle | undefined,
        availability: (availability || undefined) as
          AssetAvailability | undefined,
        condition: (condition || undefined) as AssetCondition | undefined,
        verification: (verification || undefined) as
          AssetVerification | undefined,
        warrantyExpiresOnFrom: warrantyExpiresOnFrom || undefined,
        warrantyExpiresOnTo: warrantyExpiresOnTo || undefined,
      }),
    enabled: canViewAssets,
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
    register: registerAsset,
    handleSubmit: handleAssetSubmit,
    reset: resetAsset,
    setValue: setAssetValue,
    watch: watchAsset,
    formState: { errors: assetErrors },
  } = useForm<AssetRegistrationFormInput>({
    defaultValues: {
      assetTag: "",
      categoryId: "",
      locationId: "",
      availability: "AVAILABLE",
      condition: "GOOD",
      criticality: "",
      manufacturer: "",
      model: "",
      serialNumber: "",
      sourceReference: "",
      notes: "",
      specifications: {},
      purchaseDate: "",
      warrantyExpiresOn: "",
      warrantyReference: "",
    },
  });
  const selectedAvailability = watchAsset("availability");
  const selectedCondition = watchAsset("condition");
  const selectedAssetCategoryId = watchAsset("categoryId");
  const selectedCategory = categoriesQuery.data?.items.find(
    (category) => category.id === selectedAssetCategoryId,
  );
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
    enabled: canManageAssets && checkedSerialNumber.length > 0,
  });

  const submitAsset = handleAssetSubmit((values) => {
    setMessage(null);
    const parsed = assetSchema.safeParse(values);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Invalid asset.");
      return;
    }
    const category = categoriesQuery.data?.items.find(
      (item) => item.id === parsed.data.categoryId,
    );
    const missingSpecification = category?.specificationFields.find(
      (field) =>
        field.required && !parsed.data.specifications[field.key]?.trim(),
    );
    if (missingSpecification) {
      setMessage(
        `${missingSpecification.label} is required for this category.`,
      );
      return;
    }
    const {
      manufacturer,
      model,
      serialNumber,
      sourceReference,
      notes,
      specifications,
      purchaseDate,
      warrantyExpiresOn,
      warrantyReference,
      criticality,
      ...rest
    } = parsed.data;
    createAsset.mutate({
      ...rest,
      manufacturer: manufacturer || undefined,
      model: model || undefined,
      serialNumber: serialNumber || undefined,
      sourceReference: sourceReference || undefined,
      notes: notes || undefined,
      specifications,
      purchaseDate: purchaseDate || undefined,
      warrantyExpiresOn: warrantyExpiresOn || undefined,
      warrantyReference: warrantyReference || undefined,
      criticality: criticality || undefined,
    });
  });

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Hardware</p>
        <h1>Asset register</h1>
        <p className="page-description">
          {canManageAssets
            ? "Register and manage individually tracked equipment within your assigned location scope. New records are created as received; later lifecycle changes require their own approved workflows."
            : "Review individually tracked equipment across your organization. Asset Managers handle registration and editable asset workflows."}
        </p>
      </div>

      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}

      {canViewAssets && (
        <>
          {canManageAssets && (
            <section
              className="user-admin-card modern-form-card"
              aria-labelledby="register-asset"
            >
              <div className="form-card-heading">
                <span className="form-step-mark" aria-hidden="true">
                  02
                </span>
                <div>
                  <p className="eyebrow">Hardware intake</p>
                  <h2 id="register-asset">Register received asset</h2>
                  <p>
                    Capture identifying details and the initial confirmed
                    location. This registers an individually tracked asset as
                    received.
                  </p>
                </div>
              </div>
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
              <form
                className="user-create-form modern-form asset-registration-form"
                onSubmit={submitAsset}
              >
                <div className="modern-form-grid">
                  <div className="modern-field">
                    <label htmlFor="asset-tag">Asset tag</label>
                    <input
                      id="asset-tag"
                      placeholder="e.g. IT-LAP-2048"
                      {...registerAsset("assetTag")}
                    />
                    <small>
                      Organization reference; keep leading zeros if used.
                    </small>
                    {assetErrors.assetTag && (
                      <span className="field-error">
                        {assetErrors.assetTag.message}
                      </span>
                    )}
                  </div>
                  <div className="modern-field">
                    <label htmlFor="asset-category-search">Find category</label>
                    <input
                      id="asset-category-search"
                      placeholder="Search category names"
                      onChange={(event) => {
                        setCategorySearch(event.target.value);
                        setCategoryPage(1);
                        setAssetValue("categoryId", "");
                        setAssetValue("specifications", {});
                      }}
                      value={categorySearch}
                    />
                    <small>Search the organization’s active categories.</small>
                  </div>
                  <div className="modern-field">
                    <label htmlFor="asset-category">Category</label>
                    <select
                      id="asset-category"
                      {...registerAsset("categoryId", {
                        onChange: () => setAssetValue("specifications", {}),
                      })}
                    >
                      <option value="">Select a category</option>
                      {categoriesQuery.data?.items
                        .filter((category) => category.isActive)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.code} — {category.name}
                          </option>
                        ))}
                    </select>
                    {assetErrors.categoryId && (
                      <span className="field-error">
                        {assetErrors.categoryId.message}
                      </span>
                    )}
                    {categoriesQuery.data && (
                      <div
                        className="asset-pagination asset-choice-pagination"
                        aria-label="Category choices"
                      >
                        <button
                          className="button button-secondary"
                          disabled={
                            categoryPage <= 1 || categoriesQuery.isFetching
                          }
                          onClick={() => {
                            setCategoryPage((current) => current - 1);
                            setAssetValue("categoryId", "");
                            setAssetValue("specifications", {});
                          }}
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
                          onClick={() => {
                            setCategoryPage((current) => current + 1);
                            setAssetValue("categoryId", "");
                            setAssetValue("specifications", {});
                          }}
                          type="button"
                        >
                          More
                        </button>
                      </div>
                    )}
                    <small>
                      {categoriesQuery.data
                        ? `${categoriesQuery.data.total} active category references`
                        : "Categories are loaded from your organization."}
                    </small>
                  </div>
                  <div className="modern-field modern-field-wide">
                    <label htmlFor="asset-location">Confirmed location</label>
                    <select
                      id="asset-location"
                      {...registerAsset("locationId")}
                    >
                      <option value="">Select a location</option>
                      {locationsQuery.data?.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.code} — {location.name}
                        </option>
                      ))}
                    </select>
                    <small>
                      Select the physical location where the received item is
                      currently confirmed.
                    </small>
                    {assetErrors.locationId && (
                      <span className="field-error">
                        {assetErrors.locationId.message}
                      </span>
                    )}
                  </div>
                </div>

                <div className="modern-form-section">
                  <div className="modern-form-section-heading">
                    <h3>Initial condition</h3>
                    <p>These are separate state dimensions.</p>
                  </div>
                  <div className="modern-form-grid">
                    <div className="modern-field">
                      <label htmlFor="asset-availability">
                        Initial availability
                      </label>
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
                    </div>
                    <div className="modern-field">
                      <label htmlFor="asset-condition">Condition</label>
                      <select
                        id="asset-condition"
                        {...registerAsset("condition")}
                      >
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
                            Choose quarantined or unavailable for a
                            nonfunctional asset.
                          </span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="modern-form-section">
                  <div className="modern-form-section-heading">
                    <h3>Identification details</h3>
                    <p>Optional manufacturer and serial information.</p>
                  </div>
                  <div className="modern-form-grid">
                    <div className="modern-field">
                      <label htmlFor="asset-manufacturer">Manufacturer</label>
                      <input
                        id="asset-manufacturer"
                        placeholder="e.g. Northwind Devices"
                        {...registerAsset("manufacturer")}
                      />
                    </div>
                    <div className="modern-field">
                      <label htmlFor="asset-model">Model</label>
                      <input
                        id="asset-model"
                        placeholder="e.g. ThinkPad T14"
                        {...registerAsset("model")}
                      />
                    </div>
                    <div className="modern-field modern-field-wide">
                      <label htmlFor="asset-serial">Serial number</label>
                      <input
                        id="asset-serial"
                        placeholder="Enter the serial exactly as shown"
                        {...registerAsset("serialNumber")}
                      />
                      <small>
                        Serial numbers are preserved as text and may be shared
                        by multiple records.
                      </small>
                      {serialNumber.trim().length > 0 && (
                        <div className="asset-serial-check">
                          {serialMatchesQuery.isFetching ? (
                            <p role="status">Checking accessible assets…</p>
                          ) : serialMatchesQuery.isError ? (
                            <p className="form-error" role="alert">
                              Could not check for matching serial numbers.
                              Registration is still available; verify the serial
                              number manually.
                            </p>
                          ) : checkedSerialNumber === serialNumber.trim() &&
                            serialMatchesQuery.data ? (
                            serialMatchesQuery.data.total > 0 ? (
                              <div role="status">
                                <p>
                                  {serialMatchesQuery.data.total} existing asset
                                  {serialMatchesQuery.data.total === 1
                                    ? ""
                                    : "s"}{" "}
                                  in your accessible locations{" "}
                                  {serialMatchesQuery.data.total === 1
                                    ? "has"
                                    : "have"}{" "}
                                  this exact serial number. Serial numbers are
                                  not unique; review for a possible duplicate.
                                </p>
                                <ul>
                                  {serialMatchesQuery.data.items.map(
                                    (asset) => (
                                      <li key={asset.id}>
                                        {asset.assetTag} — {asset.category.name}{" "}
                                        — {asset.location.code} (
                                        {asset.location.name})
                                      </li>
                                    ),
                                  )}
                                </ul>
                                {serialMatchesQuery.data.total >
                                  serialMatchesQuery.data.items.length && (
                                  <p>
                                    Showing{" "}
                                    {serialMatchesQuery.data.items.length} of{" "}
                                    {serialMatchesQuery.data.total} matches.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p role="status">
                                No exact serial-number matches in your
                                accessible locations.
                              </p>
                            )
                          ) : (
                            <p role="status">
                              Checking for exact serial-number matches…
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {selectedCategory?.specificationFields.length ? (
                  <div className="modern-form-section">
                    <div className="modern-form-section-heading">
                      <h3>Category specifications</h3>
                      <p>
                        Text values required by the selected hardware category.
                      </p>
                    </div>
                    <div className="modern-form-grid">
                      {selectedCategory.specificationFields.map((field) => (
                        <div className="modern-field" key={field.key}>
                          <label htmlFor={`asset-specification-${field.key}`}>
                            {field.label}
                            {field.required && <span>Required</span>}
                          </label>
                          <input
                            id={`asset-specification-${field.key}`}
                            maxLength={2000}
                            {...registerAsset(
                              `specifications.${field.key}` as const,
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="modern-form-grid">
                  <div className="modern-field">
                    <label htmlFor="asset-criticality">
                      Criticality <span>Optional</span>
                    </label>
                    <select
                      id="asset-criticality"
                      {...registerAsset("criticality")}
                    >
                      <option value="">Not set</option>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div className="modern-field">
                    <label htmlFor="asset-source">
                      Source reference <span>Optional</span>
                    </label>
                    <input
                      id="asset-source"
                      placeholder="Purchase or receiving reference"
                      {...registerAsset("sourceReference")}
                    />
                  </div>
                  <div className="modern-field">
                    <label htmlFor="asset-notes">
                      Notes <span>Optional</span>
                    </label>
                    <textarea
                      id="asset-notes"
                      placeholder="Additional descriptive notes"
                      {...registerAsset("notes")}
                    />
                  </div>
                </div>
                <div className="modern-form-grid">
                  <div className="modern-field">
                    <label htmlFor="asset-purchase-date">
                      Purchase date <span>Optional</span>
                    </label>
                    <input
                      id="asset-purchase-date"
                      type="date"
                      {...registerAsset("purchaseDate")}
                    />
                  </div>
                  <div className="modern-field">
                    <label htmlFor="asset-warranty-expiry">
                      Warranty expiry <span>Optional</span>
                    </label>
                    <input
                      id="asset-warranty-expiry"
                      type="date"
                      {...registerAsset("warrantyExpiresOn")}
                    />
                  </div>
                  <div className="modern-field modern-field-wide">
                    <label htmlFor="asset-warranty-reference">
                      Warranty or support reference <span>Optional</span>
                    </label>
                    <input
                      id="asset-warranty-reference"
                      maxLength={150}
                      {...registerAsset("warrantyReference")}
                    />
                  </div>
                </div>
                <div className="modern-form-actions">
                  <div>
                    <strong>Ready to register?</strong>
                    <small>
                      Record starts in received state; later transitions use
                      approved workflows.
                    </small>
                  </div>
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
                </div>
              </form>
            </section>
          )}

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
                  <option value="">
                    {canManageAssets
                      ? "All assigned locations"
                      : "All organization locations"}
                  </option>
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
              <label>
                Warranty expires from
                <input
                  type="date"
                  onChange={(event) => {
                    updateListSearch({
                      warrantyExpiresOnFrom: event.target.value,
                      page: 1,
                    });
                  }}
                  value={warrantyExpiresOnFrom}
                />
              </label>
              <label>
                Warranty expires through
                <input
                  type="date"
                  onChange={(event) => {
                    updateListSearch({
                      warrantyExpiresOnTo: event.target.value,
                      page: 1,
                    });
                  }}
                  value={warrantyExpiresOnTo}
                />
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
                  warrantyExpiresOnFrom: "",
                  warrantyExpiresOnTo: "",
                  page: 1,
                });
              }}
              type="button"
            >
              Reset filters
            </button>

            {!canManageAssets && categoriesQuery.isError && (
              <p className="form-error" role="alert">
                {authErrorMessage(categoriesQuery.error)}
              </p>
            )}
            {!canManageAssets && locationsQuery.isError && (
              <p className="form-error" role="alert">
                {authErrorMessage(locationsQuery.error)}
              </p>
            )}
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
                        <th>Criticality</th>
                        <th>Location</th>
                        <th>Lifecycle</th>
                        <th>Availability</th>
                        <th>Condition</th>
                        <th>Verification</th>
                        <th>Warranty expiry</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetsQuery.data.items.map((asset) => (
                        <tr key={asset.id}>
                          <td>{asset.assetTag}</td>
                          <td>{asset.category.name}</td>
                          <td>{asset.serialNumber ?? "—"}</td>
                          <td>{asset.criticality ?? "—"}</td>
                          <td>
                            {asset.location.code} — {asset.location.name}
                          </td>
                          <td>{asset.lifecycle}</td>
                          <td>{asset.availability.replaceAll("_", " ")}</td>
                          <td>{asset.condition}</td>
                          <td>{asset.verification.replaceAll("_", " ")}</td>
                          <td>
                            {asset.warrantyExpiresOn?.slice(0, 10) ?? "—"}
                          </td>
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
                                warrantyExpiresOnFrom:
                                  current.warrantyExpiresOnFrom ?? "",
                                warrantyExpiresOnTo:
                                  current.warrantyExpiresOnTo ?? "",
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
