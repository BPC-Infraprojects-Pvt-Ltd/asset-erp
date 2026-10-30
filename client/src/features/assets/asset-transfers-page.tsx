import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { locationsApi } from "../locations/locations-api";
import { canManageAssetRegister } from "./asset-access";
import {
  assetsApi,
  type Asset,
  type AssetTransfer,
  type AssetTransferLine,
  type CreateAssetTransferInput,
  type ReceiveAssetTransferLineInput,
} from "./assets-api";

type TransferDraft = Pick<
  CreateAssetTransferInput,
  "destinationLocationId" | "reason"
>;

const conditions = [
  "NEW",
  "GOOD",
  "FAIR",
  "DAMAGED",
  "NONFUNCTIONAL",
  "UNKNOWN",
] as const;

function TransferReceiptForm({
  transfer,
  line,
  onComplete,
}: {
  transfer: AssetTransfer;
  line: AssetTransferLine;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const generation = useAuthStore((state) => state.generation);
  const [attempt, setAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] =
    useState<ReceiveAssetTransferLineInput["result"]>("RECEIVED");
  const [conditionAtReceipt, setConditionAtReceipt] = useState<
    (typeof conditions)[number]
  >(line.asset.condition);
  const [inspectionRequired, setInspectionRequired] = useState(false);
  const [exceptionNote, setExceptionNote] = useState("");

  const receiveLine = useMutation({
    mutationFn: ({
      input,
      key,
    }: {
      input: ReceiveAssetTransferLineInput;
      key: string;
    }) =>
      assetsApi.receiveTransferLine(
        transfer.id,
        line.id,
        line.version,
        key,
        input,
      ),
    onSuccess: async () => {
      if (useAuthStore.getState().generation !== generation) return;
      setAttempt(null);
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("transfers"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("assets"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("asset-history", line.assetId),
        }),
      ]);
      onComplete();
    },
    onError: (error) => setErrorMessage(authErrorMessage(error)),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const input: ReceiveAssetTransferLineInput =
      result === "RECEIVED"
        ? { result, conditionAtReceipt, inspectionRequired }
        : { result, exceptionNote: exceptionNote.trim() };
    if (result !== "RECEIVED" && !exceptionNote.trim()) {
      setErrorMessage("Add an explanation for missing or rejected equipment.");
      return;
    }
    const fingerprint = JSON.stringify(input);
    const key =
      attempt?.fingerprint === fingerprint ? attempt.key : crypto.randomUUID();
    setAttempt({ fingerprint, key });
    receiveLine.mutate({ input, key });
  };

  return (
    <form className="asset-transfer-receipt" onSubmit={submit}>
      <label className="modern-field">
        <span>Receipt outcome</span>
        <select
          onChange={(event) =>
            setResult(
              event.target.value as ReceiveAssetTransferLineInput["result"],
            )
          }
          value={result}
        >
          <option value="RECEIVED">Received</option>
          <option value="MISSING">Missing in transit</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </label>
      {result === "RECEIVED" ? (
        <>
          <label className="modern-field">
            <span>Condition on receipt</span>
            <select
              onChange={(event) =>
                setConditionAtReceipt(
                  event.target.value as (typeof conditions)[number],
                )
              }
              value={conditionAtReceipt}
            >
              {conditions.map((condition) => (
                <option key={condition} value={condition}>
                  {condition.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="asset-transfer-check">
            <input
              checked={inspectionRequired}
              onChange={(event) => setInspectionRequired(event.target.checked)}
              type="checkbox"
            />
            Inspection required
          </label>
        </>
      ) : (
        <label className="modern-field">
          <span>Discrepancy details</span>
          <input
            maxLength={1000}
            onChange={(event) => setExceptionNote(event.target.value)}
            required
            value={exceptionNote}
          />
        </label>
      )}
      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}
      <button
        className="button button-secondary"
        disabled={receiveLine.isPending}
      >
        {receiveLine.isPending ? "Recording…" : "Record line outcome"}
      </button>
    </form>
  );
}

function formatTransferDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(new Date(value));
}

export function AssetTransfersPage() {
  const role = useAuthStore((state) => state.session?.user.role);
  const generation = useAuthStore((state) => state.generation);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [attempt, setAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const transfersQuery = useQuery({
    queryKey: protectedQueryKey("transfers", page, search),
    queryFn: () =>
      assetsApi.listTransfers({
        page,
        pageSize: 20,
        search: search.trim() || undefined,
      }),
    enabled: canManageAssetRegister(role),
  });
  const locationsQuery = useQuery({
    queryKey: protectedQueryKey("transfer-location-options"),
    queryFn: locationsApi.list,
    enabled: canManageAssetRegister(role),
  });
  const assetsQuery = useQuery({
    queryKey: protectedQueryKey("transfer-asset-options", assetSearch),
    queryFn: () =>
      assetsApi.list({
        page: 1,
        pageSize: 30,
        lifecycle: "ACTIVE",
        availability: "AVAILABLE",
        search: assetSearch.trim() || undefined,
      }),
    enabled: canManageAssetRegister(role) && assetSearch.trim().length >= 2,
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<TransferDraft>({
    defaultValues: { destinationLocationId: "", reason: "" },
  });

  const createTransfer = useMutation({
    mutationFn: ({
      input,
      key,
    }: {
      input: CreateAssetTransferInput;
      key: string;
    }) => assetsApi.createTransfer(input, key),
    onSuccess: async () => {
      if (useAuthStore.getState().generation !== generation) return;
      reset();
      setSelectedAssets([]);
      setAssetSearch("");
      setAttempt(null);
      setMessageIsError(false);
      setMessage("Transfer draft created.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("transfers"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("assets"),
        }),
      ]);
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });
  const dispatchTransfer = useMutation({
    mutationFn: ({
      transferId,
      version,
    }: {
      transferId: string;
      version: number;
    }) => assetsApi.dispatchTransfer(transferId, version),
    onSuccess: async (transfer) => {
      setMessageIsError(false);
      setMessage("Transfer dispatched. Confirm receipt for each asset.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("transfers"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("assets"),
        }),
        ...transfer.lines.map((line) =>
          queryClient.invalidateQueries({
            queryKey: protectedQueryKey("asset-history", line.assetId),
          }),
        ),
      ]);
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });
  const cancelTransfer = useMutation({
    mutationFn: ({
      transferId,
      version,
    }: {
      transferId: string;
      version: number;
    }) => assetsApi.cancelTransfer(transferId, version),
    onSuccess: async () => {
      setMessageIsError(false);
      setMessage(
        "Draft cancelled. The assets remain at their source location.",
      );
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("transfers"),
      });
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });

  const pageCount = transfersQuery.data
    ? Math.max(1, Math.ceil(transfersQuery.data.total / 20))
    : 1;
  const sourceLocation = selectedAssets[0]?.location;
  const activeLocations = (locationsQuery.data ?? []).filter(
    (location) => location.isActive && location.id !== sourceLocation?.id,
  );

  if (!canManageAssetRegister(role)) {
    return (
      <section>
        <div className="page-heading">
          <p className="eyebrow">Hardware</p>
          <h1>Transfers</h1>
          <p className="page-description">
            Transfer commands are available to Asset Managers within their
            assigned location scope.
          </p>
        </div>
        <p className="form-error" role="alert">
          Asset Manager access is required.
        </p>
      </section>
    );
  }

  const submit = handleSubmit((values) => {
    setMessage(null);
    if (!selectedAssets.length) {
      setMessageIsError(true);
      setMessage("Select at least one asset for the transfer.");
      return;
    }
    if (!sourceLocation || values.destinationLocationId === sourceLocation.id) {
      setError("destinationLocationId", {
        message: "Choose a destination different from the source.",
      });
      return;
    }
    const input: CreateAssetTransferInput = {
      destinationLocationId: values.destinationLocationId,
      assetIds: selectedAssets.map((asset) => asset.id),
      reason: values.reason.trim(),
    };
    const fingerprint = JSON.stringify(input);
    const key =
      attempt?.fingerprint === fingerprint ? attempt.key : crypto.randomUUID();
    setAttempt({ fingerprint, key });
    createTransfer.mutate({ input, key });
  });

  const addAsset = (asset: Asset) => {
    if (selectedAssets.some((selected) => selected.id === asset.id)) return;
    if (
      selectedAssets.length &&
      selectedAssets[0]?.locationId !== asset.locationId
    ) {
      setMessageIsError(true);
      setMessage("All assets in a transfer must share one source location.");
      return;
    }
    setMessage(null);
    setSelectedAssets((current) => [...current, asset]);
  };

  return (
    <section className="asset-transfers-page">
      <div className="page-heading">
        <p className="eyebrow">Hardware · Movement control</p>
        <h1>Transfers</h1>
        <p className="page-description">
          Draft movement of active equipment, dispatch the full transfer, then
          record a confirmed outcome for every asset. Location changes only on
          confirmed receipt.
        </p>
        <Link
          className="button button-secondary"
          search={{
            page: 1,
            search: "",
            locationId: "",
            categoryId: "",
            lifecycle: "",
            availability: "",
            condition: "",
            verification: "",
            warrantyExpiresOnFrom: "",
            warrantyExpiresOnTo: "",
          }}
          to="/assets"
        >
          Open Asset Register
        </Link>
      </div>

      {message && (
        <p
          className={messageIsError ? "form-error" : "form-notice"}
          role={messageIsError ? "alert" : "status"}
        >
          {message}
        </p>
      )}

      <section className="user-admin-card modern-form-card">
        <div className="form-card-heading">
          <span className="form-step-mark" aria-hidden="true">
            01
          </span>
          <div>
            <p className="eyebrow">Movement preparation</p>
            <h2>Create transfer draft</h2>
            <p>
              Select available assets from one source location. Drafting does
              not change confirmed asset location or availability.
            </p>
          </div>
        </div>
        <form className="user-create-form modern-form" onSubmit={submit}>
          <div className="modern-form-grid master-live-form-grid">
            <div className="modern-field">
              <label htmlFor="transfer-asset-search">Find assets</label>
              <input
                id="transfer-asset-search"
                onChange={(event) => setAssetSearch(event.target.value)}
                placeholder="Search at least 2 characters"
                value={assetSearch}
              />
              {assetsQuery.data?.items.map((asset) => {
                const incompatibleSource =
                  selectedAssets.length > 0 &&
                  selectedAssets[0]?.locationId !== asset.locationId;
                const selected = selectedAssets.some(
                  (item) => item.id === asset.id,
                );
                return (
                  <button
                    className={
                      selected
                        ? "asset-reservation-option selected"
                        : "asset-reservation-option"
                    }
                    disabled={selected || incompatibleSource}
                    key={asset.id}
                    onClick={() => addAsset(asset)}
                    type="button"
                  >
                    {asset.assetTag} · {asset.category.name} ·{" "}
                    {asset.location.code}
                  </button>
                );
              })}
              {assetsQuery.isError && (
                <span className="field-error" role="alert">
                  {authErrorMessage(assetsQuery.error)}
                </span>
              )}
              {assetsQuery.data?.items.length === 0 && (
                <small>No active, available assets match this search.</small>
              )}
            </div>
            <div className="modern-field">
              <label htmlFor="transfer-destination">Destination</label>
              <select
                id="transfer-destination"
                {...register("destinationLocationId", {
                  required: "Choose a destination.",
                })}
                aria-invalid={Boolean(errors.destinationLocationId)}
              >
                <option value="">Choose location</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} · {location.name}
                  </option>
                ))}
              </select>
              {locationsQuery.isError && (
                <span className="field-error" role="alert">
                  {authErrorMessage(locationsQuery.error)}
                </span>
              )}
              {errors.destinationLocationId && (
                <span className="field-error" role="alert">
                  {errors.destinationLocationId.message}
                </span>
              )}
            </div>
            <div className="modern-field modern-field-wide">
              <label htmlFor="transfer-reason">Movement reason</label>
              <textarea
                id="transfer-reason"
                maxLength={500}
                {...register("reason", {
                  required: "Enter the transfer reason.",
                  validate: (value) =>
                    Boolean(value.trim()) || "Enter the transfer reason.",
                })}
                aria-invalid={Boolean(errors.reason)}
              />
              {errors.reason && (
                <span className="field-error" role="alert">
                  {errors.reason.message}
                </span>
              )}
            </div>
          </div>
          <div className="asset-transfer-selection">
            <div>
              <strong>Selected assets ({selectedAssets.length})</strong>
              <span>
                {sourceLocation
                  ? `Source: ${sourceLocation.code} · ${sourceLocation.name}`
                  : "Choose assets to establish the source location."}
              </span>
            </div>
            {selectedAssets.map((asset) => (
              <button
                className="asset-transfer-selected"
                key={asset.id}
                onClick={() =>
                  setSelectedAssets((current) =>
                    current.filter((item) => item.id !== asset.id),
                  )
                }
                title="Remove from transfer"
                type="button"
              >
                {asset.assetTag} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
          <div className="modern-form-actions master-live-form-actions">
            <div>
              <strong>Asset Manager command</strong>
              <small>
                Draft creation is idempotent and does not move the assets.
              </small>
            </div>
            <button className="button" disabled={createTransfer.isPending}>
              {createTransfer.isPending ? "Saving…" : "Create transfer draft"}
            </button>
          </div>
        </form>
      </section>

      <section className="user-admin-card">
        <div className="asset-reservations-list-heading">
          <div>
            <p className="eyebrow">Movement ledger</p>
            <h2>Transfers and receiving</h2>
          </div>
          {transfersQuery.data && (
            <span className="master-live-total">
              {transfersQuery.data.total} total
            </span>
          )}
        </div>
        <label className="master-live-search asset-reservation-search">
          <span>Search transfer reason or asset tag</span>
          <input
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            value={search}
          />
        </label>
        {transfersQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(transfersQuery.error)}
          </p>
        )}
        {transfersQuery.isPending ? (
          <p className="master-live-state" role="status">
            Loading transfers…
          </p>
        ) : transfersQuery.data?.items.length ? (
          <div className="asset-transfer-ledger">
            {transfersQuery.data.items.map((transfer) => (
              <article className="asset-transfer-card" key={transfer.id}>
                <div className="asset-transfer-card-heading">
                  <div>
                    <p className="eyebrow">
                      Transfer · {transfer.id.slice(0, 8).toUpperCase()}
                    </p>
                    <h3>
                      {transfer.sourceLocation.code} →{" "}
                      {transfer.destinationLocation.code}
                    </h3>
                    <p>{transfer.reason}</p>
                  </div>
                  <div className="asset-transfer-state">
                    <span
                      className={`asset-transfer-status ${transfer.status.toLowerCase()}`}
                    >
                      {transfer.status.replaceAll("_", " ")}
                    </span>
                    <small>Version {transfer.version}</small>
                    <small>
                      Created {formatTransferDate(transfer.createdAt)}
                    </small>
                  </div>
                </div>
                {transfer.status === "DRAFT" && (
                  <div className="asset-transfer-dispatch">
                    <p>
                      {transfer.lines.length} asset
                      {transfer.lines.length === 1 ? "" : "s"} ready for
                      dispatch. Confirm physical handover before dispatching.
                      Drafts can be cancelled; dispatched movements need an
                      explicit recovery process.
                    </p>
                    <div className="asset-transfer-actions">
                      <button
                        className="button button-secondary"
                        disabled={cancelTransfer.isPending}
                        onClick={() =>
                          cancelTransfer.mutate({
                            transferId: transfer.id,
                            version: transfer.version,
                          })
                        }
                        type="button"
                      >
                        Cancel draft
                      </button>
                      <button
                        className="button"
                        disabled={dispatchTransfer.isPending}
                        onClick={() =>
                          dispatchTransfer.mutate({
                            transferId: transfer.id,
                            version: transfer.version,
                          })
                        }
                        type="button"
                      >
                        {dispatchTransfer.isPending
                          ? "Dispatching…"
                          : "Confirm dispatch"}
                      </button>
                    </div>
                  </div>
                )}
                <div className="user-table-scroll">
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th scope="col">Asset</th>
                        <th scope="col">Asset status</th>
                        <th scope="col">Receipt outcome</th>
                        <th scope="col">Evidence / action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfer.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            <Link
                              search={{
                                page: 1,
                                search: "",
                                locationId: "",
                                categoryId: "",
                                lifecycle: "",
                                availability: "",
                                condition: "",
                                verification: "",
                                warrantyExpiresOnFrom: "",
                                warrantyExpiresOnTo: "",
                              }}
                              to="/assets/$assetId"
                              params={{ assetId: line.assetId }}
                            >
                              {line.asset.assetTag}
                            </Link>
                            <small>
                              {line.asset.category.name} ·{" "}
                              {line.asset.location.code}
                            </small>
                          </td>
                          <td>
                            {line.asset.availability.replaceAll("_", " ")}
                          </td>
                          <td>
                            <strong>{line.status.replaceAll("_", " ")}</strong>
                            {line.receivedAt && (
                              <small>
                                {formatTransferDate(line.receivedAt)}
                              </small>
                            )}
                            {line.conditionAtReceipt && (
                              <small>
                                {line.conditionAtReceipt.replaceAll("_", " ")}
                                {line.inspectionRequired
                                  ? " · inspection required"
                                  : ""}
                              </small>
                            )}
                            {line.exceptionNote && (
                              <small className="form-error">
                                {line.exceptionNote}
                              </small>
                            )}
                          </td>
                          <td>
                            {(transfer.status === "IN_TRANSIT" ||
                              transfer.status === "PARTIALLY_RECEIVED") &&
                              line.status === "IN_TRANSIT" && (
                                <TransferReceiptForm
                                  key={`${line.id}:${line.version}`}
                                  line={line}
                                  onComplete={() => {
                                    setMessageIsError(false);
                                    setMessage("Line outcome recorded.");
                                  }}
                                  transfer={transfer}
                                />
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        ) : transfersQuery.isError ? null : (
          <p className="master-live-state">No transfers found.</p>
        )}
        {transfersQuery.data && (
          <div className="asset-pagination" aria-label="Transfer pages">
            <span>
              Page {page} of {pageCount}
            </span>
            <button
              className="button button-secondary"
              disabled={page <= 1 || transfersQuery.isFetching}
              onClick={() => setPage((current) => current - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="button button-secondary"
              disabled={page >= pageCount || transfersQuery.isFetching}
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
