import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { assetsApi } from "./assets-api";
import {
  retirementRequestsApi,
  type CreateRetirementRequestInput,
} from "./retirement-requests-api";
import { Route } from "../../routes/retirements";

const pageSize = 20;
const requestSchema = z.strictObject({
  reason: z.string().trim().min(1, "Enter a retirement reason.").max(1000),
  impactReview: z
    .string()
    .trim()
    .min(1, "Describe the operational impact and recovery review.")
    .max(2000),
});

function commandKey(
  attempt: { fingerprint: string; key: string } | null,
  fingerprint: string,
) {
  return attempt?.fingerprint === fingerprint
    ? attempt.key
    : crypto.randomUUID();
}

export function RetirementRequestsPage() {
  const { assetId: preselectedAssetId } = Route.useSearch();
  const queryClient = useQueryClient();
  const generation = useAuthStore((state) => state.generation);
  const [page, setPage] = useState(1);
  const [assetSearch, setAssetSearch] = useState("");
  const [manualSelectedAssetId, setManualSelectedAssetId] = useState("");
  const selectedAssetId = preselectedAssetId ?? manualSelectedAssetId;
  const [attempt, setAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRetirementRequestInput>({
    defaultValues: { reason: "", impactReview: "" },
  });

  const assetsQuery = useQuery({
    queryKey: protectedQueryKey(
      "retirement-asset-options",
      preselectedAssetId,
      assetSearch,
    ),
    queryFn: () =>
      assetsApi.list({
        page: 1,
        pageSize: 20,
        assetIdExact: preselectedAssetId || undefined,
        search: preselectedAssetId
          ? undefined
          : assetSearch.trim() || undefined,
      }),
    enabled: Boolean(preselectedAssetId) || assetSearch.trim().length >= 2,
  });
  const requestsQuery = useQuery({
    queryKey: protectedQueryKey("retirement-requests", page),
    queryFn: () => retirementRequestsApi.list({ page, pageSize }),
  });

  const createRequest = useMutation({
    mutationFn: ({
      assetId,
      input,
      idempotencyKey,
    }: {
      assetId: string;
      input: CreateRetirementRequestInput;
      idempotencyKey: string;
    }) => retirementRequestsApi.create(assetId, input, idempotencyKey),
    onSuccess: async () => {
      if (useAuthStore.getState().generation !== generation) return;
      reset();
      setAttempt(null);
      setMessageIsError(false);
      setMessage(
        "Retirement request submitted for review. The asset lifecycle, location, and custody were not changed.",
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("retirement-requests"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("asset-history", selectedAssetId),
        }),
      ]);
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });

  function submit(values: CreateRetirementRequestInput) {
    if (!selectedAssetId) {
      setMessageIsError(true);
      setMessage("Choose the asset for this retirement request.");
      return;
    }
    const parsed = requestSchema.safeParse(values);
    if (!parsed.success) {
      setMessageIsError(true);
      setMessage(
        parsed.error.issues[0]?.message ?? "Check the request details.",
      );
      return;
    }
    const selectedAsset = assetsQuery.data?.items.find(
      (asset) => asset.id === selectedAssetId,
    );
    if (
      selectedAsset?.lifecycle === "RETIRED" ||
      selectedAsset?.lifecycle === "DISPOSED"
    ) {
      setMessageIsError(true);
      setMessage(
        "Retired or disposed assets cannot receive a retirement request.",
      );
      return;
    }
    const fingerprint = JSON.stringify({
      assetId: selectedAssetId,
      ...parsed.data,
    });
    const key = commandKey(attempt, fingerprint);
    setAttempt({ fingerprint, key });
    createRequest.mutate({
      assetId: selectedAssetId,
      input: parsed.data,
      idempotencyKey: key,
    });
  }

  const pageCount = Math.max(
    1,
    Math.ceil((requestsQuery.data?.total ?? 0) / pageSize),
  );

  return (
    <main className="user-admin-page retirement-requests-page">
      <header className="user-admin-header">
        <div>
          <p className="eyebrow">Hardware lifecycle</p>
          <h1>Retirement requests</h1>
          <p>
            Submit a reason and impact review for authorized follow-up.
            Submitting a request does not retire or dispose of an asset.
          </p>
        </div>
      </header>

      {message && (
        <p
          className={messageIsError ? "form-error" : "form-success"}
          role={messageIsError ? "alert" : "status"}
        >
          {message}
        </p>
      )}

      <section className="user-admin-card" aria-labelledby="create-retirement">
        <h2 id="create-retirement">Submit retirement request</h2>
        <p>
          Requests remain pending review. Approval authority, recovery
          completion, sanitization evidence, and disposal are separate steps and
          are not enabled here.
        </p>
        <form
          className="modern-form-grid"
          onSubmit={(event) => {
            void handleSubmit(submit)(event);
          }}
        >
          {!preselectedAssetId && (
            <>
              <label className="modern-field">
                Find asset
                <input
                  onChange={(event) => setAssetSearch(event.target.value)}
                  placeholder="Search by asset tag, serial, or model"
                  value={assetSearch}
                />
              </label>
              <label className="modern-field">
                Asset
                <select
                  onChange={(event) =>
                    setManualSelectedAssetId(event.target.value)
                  }
                  value={selectedAssetId}
                >
                  <option value="">Choose an asset</option>
                  {assetsQuery.data?.items.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.assetTag} — {asset.category.name} ·{" "}
                      {asset.location.code}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {preselectedAssetId &&
            assetsQuery.data?.items.map((asset) => (
              <div className="retirement-selected-asset" key={asset.id}>
                <span>Selected asset</span>
                <strong>
                  {asset.assetTag} — {asset.category.name}
                </strong>
                <small>
                  {asset.lifecycle} · {asset.location.code} —{" "}
                  {asset.location.name}
                </small>
              </div>
            ))}
          <label className="modern-field">
            Retirement reason
            <textarea maxLength={1000} {...register("reason")} />
            {errors.reason && (
              <span className="form-error">{errors.reason.message}</span>
            )}
          </label>
          <label className="modern-field">
            Impact and recovery review
            <textarea maxLength={2000} {...register("impactReview")} />
            {errors.impactReview && (
              <span className="form-error">{errors.impactReview.message}</span>
            )}
            <small>
              Note known assignments, licenses, communication services, reusable
              components, and operational impact. This is not a confirmation
              that recovery is complete.
            </small>
          </label>
          {assetsQuery.isError && (
            <p className="form-error" role="alert">
              {authErrorMessage(assetsQuery.error)}
            </p>
          )}
          <div className="modern-form-actions">
            <button
              className="button"
              disabled={createRequest.isPending}
              type="submit"
            >
              {createRequest.isPending ? "Submitting…" : "Submit for review"}
            </button>
          </div>
        </form>
      </section>

      <section
        className="user-admin-card"
        aria-labelledby="retirement-request-list"
      >
        <h2 id="retirement-request-list">Submitted requests</h2>
        {requestsQuery.isPending ? (
          <p role="status">Loading retirement requests…</p>
        ) : requestsQuery.isError ? (
          <p className="form-error" role="alert">
            {authErrorMessage(requestsQuery.error)}
          </p>
        ) : requestsQuery.data?.items.length ? (
          <>
            <div className="user-table-scroll">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Current state</th>
                    <th>Reason</th>
                    <th>Impact review</th>
                    <th>Requested by</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {requestsQuery.data.items.map((request) => (
                    <tr key={request.id}>
                      <td>
                        {request.asset.assetTag} · {request.asset.category.name}
                      </td>
                      <td>
                        {request.asset.lifecycle} ·{" "}
                        {request.asset.location.code} ·{" "}
                        {request.asset.availability.replaceAll("_", " ")}
                      </td>
                      <td>{request.reason}</td>
                      <td>{request.impactReview}</td>
                      <td>{request.requestedBy.displayName}</td>
                      <td>Pending review</td>
                      <td>
                        {new Date(request.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="asset-pagination">
              <span>
                {requestsQuery.data.total} requests · Page {page} of {pageCount}
              </span>
              <button
                className="button button-secondary"
                disabled={page <= 1 || requestsQuery.isFetching}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                Previous
              </button>
              <button
                className="button button-secondary"
                disabled={page >= pageCount || requestsQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p>No retirement requests have been submitted.</p>
        )}
      </section>
    </main>
  );
}
