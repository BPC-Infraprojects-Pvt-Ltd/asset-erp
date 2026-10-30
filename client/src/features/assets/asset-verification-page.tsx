import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { locationsApi, type Location } from "../locations/locations-api";
import {
  verificationApi,
  type CreateVerificationCampaignInput,
  type CreateVerificationObservationInput,
  type VerificationCampaign,
  type VerificationCampaignAsset,
  type VerificationObservation,
  type VerificationObservationResolution,
} from "./verification-api";

const pageSize = 20;
const campaignSchema = z.strictObject({
  locationId: z.string().uuid("Choose a location."),
  name: z.string().trim().min(1, "Enter a campaign name.").max(150),
});
const observationSchema = z.strictObject({
  found: z.enum(["yes", "no"]),
  observedTag: z.string().trim().max(100),
  observedLocationId: z.string(),
  observedCustodianNumber: z.string().trim().max(150),
  observedCondition: z.enum([
    "",
    "NEW",
    "GOOD",
    "FAIR",
    "DAMAGED",
    "NONFUNCTIONAL",
    "UNKNOWN",
  ]),
  notes: z.string().trim().max(2000),
});

type ObservationFormValues = z.infer<typeof observationSchema>;

function commandKey(
  keys: Map<string, { fingerprint: string; key: string }>,
  slot: string,
  fingerprint: string,
): string {
  const existing = keys.get(slot);
  if (existing?.fingerprint === fingerprint) return existing.key;
  const key = crypto.randomUUID();
  keys.set(slot, { fingerprint, key });
  return key;
}

function campaignError(queryError: unknown): string {
  return authErrorMessage(queryError);
}

function VerificationObservationForm({
  campaignLocationId,
  expectedAsset,
  locations,
  disabled,
  onRecord,
}: {
  campaignLocationId: string;
  expectedAsset?: VerificationCampaignAsset;
  locations: Location[];
  disabled: boolean;
  onRecord: (
    expectedAssetId: string | undefined,
    input: CreateVerificationObservationInput,
  ) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const { register, handleSubmit, watch } = useForm<ObservationFormValues>({
    defaultValues: {
      found: "yes",
      observedTag: expectedAsset?.expectedAssetTag ?? "",
      observedLocationId:
        expectedAsset?.expectedLocationId ?? campaignLocationId,
      observedCustodianNumber: "",
      observedCondition: expectedAsset?.expectedCondition ?? "",
      notes: "",
    },
  });
  const found = watch("found") === "yes";

  const submit = handleSubmit((values) => {
    const parsed = observationSchema.safeParse(values);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Check the observation.");
      return;
    }
    if (
      parsed.data.found === "yes" &&
      (!parsed.data.observedTag ||
        !parsed.data.observedLocationId ||
        !parsed.data.observedCondition)
    ) {
      setMessage(
        "A found asset needs its tag, observed location, and condition.",
      );
      return;
    }
    setMessage(null);
    const input: CreateVerificationObservationInput = {
      found: parsed.data.found === "yes",
      ...(parsed.data.found === "yes"
        ? {
            observedTag: parsed.data.observedTag,
            observedLocationId: parsed.data.observedLocationId,
            observedCustodianNumber:
              parsed.data.observedCustodianNumber || undefined,
            observedCondition: parsed.data.observedCondition as
              "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "NONFUNCTIONAL" | "UNKNOWN",
          }
        : {}),
      notes: parsed.data.notes || undefined,
    };
    onRecord(expectedAsset?.id, input);
  });

  return (
    <form
      className="asset-verification-form"
      onSubmit={(event) => void submit(event)}
    >
      <label>
        Observation
        <select {...register("found")}>
          <option value="yes">Asset found</option>
          {expectedAsset && <option value="no">Not found</option>}
        </select>
      </label>
      {found && (
        <>
          <label>
            Observed tag
            <input maxLength={100} {...register("observedTag")} />
          </label>
          <label>
            Observed location
            <select {...register("observedLocationId")}>
              <option value="">Choose location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} — {location.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observed custodian employee number
            <input maxLength={150} {...register("observedCustodianNumber")} />
          </label>
          <label>
            Observed condition
            <select {...register("observedCondition")}>
              <option value="">Choose condition</option>
              {[
                "NEW",
                "GOOD",
                "FAIR",
                "DAMAGED",
                "NONFUNCTIONAL",
                "UNKNOWN",
              ].map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label>
        Observation notes
        <textarea maxLength={2000} {...register("notes")} />
      </label>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <button
        className="button button-secondary"
        disabled={disabled}
        type="submit"
      >
        Record observation
      </button>
    </form>
  );
}

function resolutionLabel(
  resolution: VerificationObservationResolution,
): string {
  return resolution === "PENDING" ? "Needs review" : resolution.toLowerCase();
}

function ObservationReview({
  observation,
  disabled,
  onResolve,
}: {
  observation: VerificationObservation;
  disabled: boolean;
  onResolve: (
    observation: VerificationObservation,
    applyFinding: boolean,
  ) => void;
}) {
  if (observation.resolution !== "PENDING") {
    return <span>{resolutionLabel(observation.resolution)}</span>;
  }
  return (
    <div className="asset-verification-review">
      {observation.expectedAssetId && (
        <button
          className="button button-secondary"
          disabled={disabled}
          onClick={() => onResolve(observation, true)}
          type="button"
        >
          Apply finding
        </button>
      )}
      <button
        className="button button-secondary"
        disabled={disabled}
        onClick={() => onResolve(observation, false)}
        type="button"
      >
        {observation.expectedAssetId ? "Dismiss" : "Mark reviewed"}
      </button>
    </div>
  );
}

export function AssetVerificationPage() {
  const queryClient = useQueryClient();
  const generation = useAuthStore((state) => state.generation);
  const navigate = useNavigate({ from: "/verification-campaigns" });
  const { campaignId } = useSearch({ from: "/verification-campaigns" });
  const [campaignPage, setCampaignPage] = useState(1);
  const [assetPage, setAssetPage] = useState(1);
  const [observationPage, setObservationPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const attempts = useRef(
    new Map<string, { fingerprint: string; key: string }>(),
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateVerificationCampaignInput>({
    defaultValues: { locationId: "", name: "" },
  });

  const locationsQuery = useQuery({
    queryKey: protectedQueryKey("verification-locations"),
    queryFn: locationsApi.list,
  });
  const campaignsQuery = useQuery({
    queryKey: protectedQueryKey("verification-campaigns", campaignPage),
    queryFn: () =>
      verificationApi.listCampaigns({ page: campaignPage, pageSize }),
  });
  const campaignQuery = useQuery({
    queryKey: protectedQueryKey("verification-campaign", campaignId),
    queryFn: () => verificationApi.getCampaign(campaignId!),
    enabled: Boolean(campaignId),
  });
  const assetsQuery = useQuery({
    queryKey: protectedQueryKey("verification-assets", campaignId, assetPage),
    queryFn: () =>
      verificationApi.listAssets(campaignId!, {
        page: assetPage,
        pageSize,
      }),
    enabled: Boolean(campaignId),
  });
  const observationsQuery = useQuery({
    queryKey: protectedQueryKey(
      "verification-observations",
      campaignId,
      observationPage,
    ),
    queryFn: () =>
      verificationApi.listObservations(campaignId!, {
        page: observationPage,
        pageSize,
      }),
    enabled: Boolean(campaignId),
  });

  const invalidateCampaign = async (id: string) => {
    if (useAuthStore.getState().generation !== generation) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("verification-campaigns"),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("verification-campaign", id),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("verification-assets", id),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("verification-observations", id),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("assets"),
      }),
    ]);
  };

  const createCampaign = useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateVerificationCampaignInput;
      idempotencyKey: string;
    }) => verificationApi.createCampaign(input, idempotencyKey),
    onSuccess: async (created) => {
      if (useAuthStore.getState().generation !== generation) return;
      reset();
      attempts.current.delete("create-campaign");
      setMessage("Verification campaign created from a location snapshot.");
      setMessageIsError(false);
      setAssetPage(1);
      setObservationPage(1);
      await invalidateCampaign(created.id);
      await navigate({ search: { campaignId: created.id } });
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(campaignError(error));
    },
  });
  const recordObservation = useMutation({
    mutationFn: ({
      expectedAssetId,
      input,
      idempotencyKey,
    }: {
      expectedAssetId?: string;
      input: CreateVerificationObservationInput;
      idempotencyKey: string;
    }) =>
      expectedAssetId
        ? verificationApi.recordExpectedObservation(
            campaignId!,
            expectedAssetId,
            input,
            idempotencyKey,
          )
        : verificationApi.recordUnexpectedObservation(
            campaignId!,
            input,
            idempotencyKey,
          ),
    onSuccess: async (observation) => {
      if (useAuthStore.getState().generation !== generation) return;
      attempts.current.delete(
        `observe:${observation.expectedAssetId ?? "unexpected"}`,
      );
      setMessage(
        "Observation recorded; no asset custody or location was changed.",
      );
      setMessageIsError(false);
      await invalidateCampaign(observation.campaignId);
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(campaignError(error));
    },
  });
  const reconcileObservation = useMutation({
    mutationFn: ({
      observation,
      applyFinding,
      idempotencyKey,
    }: {
      observation: VerificationObservation;
      applyFinding: boolean;
      idempotencyKey: string;
    }) =>
      verificationApi.reconcileObservation(
        campaignId!,
        observation.id,
        observation.version,
        { applyFinding },
        idempotencyKey,
      ),
    onSuccess: async (observation) => {
      if (useAuthStore.getState().generation !== generation) return;
      attempts.current.delete(`reconcile:${observation.id}`);
      setMessage(
        observation.resolution === "RECONCILED"
          ? "Finding applied to the verification status only."
          : "Observation dismissed; authoritative asset data was unchanged.",
      );
      setMessageIsError(false);
      await invalidateCampaign(observation.campaignId);
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(campaignError(error));
    },
  });
  const completeCampaign = useMutation({
    mutationFn: ({
      campaign,
      idempotencyKey,
    }: {
      campaign: VerificationCampaign;
      idempotencyKey: string;
    }) =>
      verificationApi.completeCampaign(
        campaign.id,
        campaign.version,
        idempotencyKey,
      ),
    onSuccess: async (completed) => {
      if (useAuthStore.getState().generation !== generation) return;
      attempts.current.delete(`complete:${completed.id}`);
      setMessage("Verification campaign completed.");
      setMessageIsError(false);
      await invalidateCampaign(completed.id);
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(campaignError(error));
    },
  });

  function submitCampaign(values: CreateVerificationCampaignInput) {
    const parsed = campaignSchema.safeParse(values);
    if (!parsed.success) {
      setMessageIsError(true);
      setMessage(
        parsed.error.issues[0]?.message ?? "Check the campaign details.",
      );
      return;
    }
    const fingerprint = JSON.stringify(parsed.data);
    createCampaign.mutate({
      input: parsed.data,
      idempotencyKey: commandKey(
        attempts.current,
        "create-campaign",
        fingerprint,
      ),
    });
  }

  function submitObservation(
    expectedAssetId: string | undefined,
    input: CreateVerificationObservationInput,
  ) {
    const slot = `observe:${expectedAssetId ?? "unexpected"}`;
    const fingerprint = JSON.stringify({
      campaignId,
      expectedAssetId: expectedAssetId ?? null,
      input,
    });
    recordObservation.mutate({
      expectedAssetId,
      input,
      idempotencyKey: commandKey(attempts.current, slot, fingerprint),
    });
  }

  function reviewObservation(
    observation: VerificationObservation,
    applyFinding: boolean,
  ) {
    const slot = `reconcile:${observation.id}`;
    const fingerprint = JSON.stringify({
      campaignId,
      observationId: observation.id,
      version: observation.version,
      applyFinding,
    });
    reconcileObservation.mutate({
      observation,
      applyFinding,
      idempotencyKey: commandKey(attempts.current, slot, fingerprint),
    });
  }

  function finishCampaign(campaign: VerificationCampaign) {
    const slot = `complete:${campaign.id}`;
    const fingerprint = JSON.stringify({
      campaignId: campaign.id,
      version: campaign.version,
    });
    completeCampaign.mutate({
      campaign,
      idempotencyKey: commandKey(attempts.current, slot, fingerprint),
    });
  }

  const selectedCampaign = campaignQuery.data;
  const isPending =
    createCampaign.isPending ||
    recordObservation.isPending ||
    reconcileObservation.isPending ||
    completeCampaign.isPending;

  return (
    <main className="user-admin-page asset-verification-page">
      <header className="user-admin-header">
        <div>
          <p className="eyebrow">Hardware controls</p>
          <h1>Physical verification</h1>
          <p>
            Create a scoped snapshot, record what was observed, then explicitly
            review findings. Observations never change custody, location, or
            lifecycle.
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

      <section
        className="user-admin-card"
        aria-labelledby="create-verification"
      >
        <h2 id="create-verification">Start a verification campaign</h2>
        <form
          className="modern-form-grid"
          onSubmit={(event) => {
            void handleSubmit(submitCampaign)(event);
          }}
        >
          <label className="modern-field">
            Campaign name
            <input maxLength={150} {...register("name")} />
            {errors.name && (
              <span className="form-error">{errors.name.message}</span>
            )}
          </label>
          <label className="modern-field">
            Location snapshot
            <select {...register("locationId")}>
              <option value="">Choose an accessible location</option>
              {locationsQuery.data
                ?.filter((location) => location.isActive)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} — {location.name}
                  </option>
                ))}
            </select>
            {errors.locationId && (
              <span className="form-error">{errors.locationId.message}</span>
            )}
          </label>
          <div className="modern-form-actions">
            <button
              className="button"
              disabled={createCampaign.isPending || locationsQuery.isPending}
              type="submit"
            >
              {createCampaign.isPending ? "Creating…" : "Create snapshot"}
            </button>
          </div>
        </form>
        {locationsQuery.isError && (
          <p className="form-error" role="alert">
            {campaignError(locationsQuery.error)}
          </p>
        )}
      </section>

      <section
        className="user-admin-card"
        aria-labelledby="verification-campaigns"
      >
        <h2 id="verification-campaigns">Campaigns</h2>
        {campaignsQuery.isPending ? (
          <p role="status">Loading campaigns…</p>
        ) : campaignsQuery.isError ? (
          <p className="form-error" role="alert">
            {campaignError(campaignsQuery.error)}
          </p>
        ) : campaignsQuery.data?.items.length ? (
          <>
            <div className="user-table-scroll">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Expected assets</th>
                    <th>Observations</th>
                    <th>Status</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignsQuery.data.items.map((campaign) => (
                    <tr key={campaign.id}>
                      <td>{campaign.name}</td>
                      <td>
                        {campaign.location.code} — {campaign.location.name}
                      </td>
                      <td>{campaign._count.expectedAssets}</td>
                      <td>{campaign._count.observations}</td>
                      <td>{campaign.status}</td>
                      <td>
                        <button
                          className="button button-secondary"
                          onClick={() => {
                            setMessage(null);
                            setMessageIsError(false);
                            void navigate({
                              search: { campaignId: campaign.id },
                            });
                          }}
                          type="button"
                        >
                          View campaign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="asset-pagination">
              <span>
                {campaignsQuery.data.total} campaigns · Page {campaignPage} of{" "}
                {Math.max(1, Math.ceil(campaignsQuery.data.total / pageSize))}
              </span>
              <button
                className="button button-secondary"
                disabled={campaignPage <= 1 || campaignsQuery.isFetching}
                onClick={() => setCampaignPage((current) => current - 1)}
                type="button"
              >
                Previous
              </button>
              <button
                className="button button-secondary"
                disabled={
                  campaignPage >=
                    Math.ceil(campaignsQuery.data.total / pageSize) ||
                  campaignsQuery.isFetching
                }
                onClick={() => setCampaignPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p>No verification campaigns yet.</p>
        )}
      </section>

      {campaignId && (
        <section className="user-admin-card" aria-labelledby="campaign-detail">
          {campaignQuery.isPending ? (
            <p role="status">Loading campaign…</p>
          ) : campaignQuery.isError || !selectedCampaign ? (
            <p className="form-error" role="alert">
              {campaignError(campaignQuery.error)}
            </p>
          ) : (
            <>
              <div className="asset-verification-heading">
                <div>
                  <p className="eyebrow">
                    {selectedCampaign.location.code} · {selectedCampaign.status}
                  </p>
                  <h2 id="campaign-detail">{selectedCampaign.name}</h2>
                  <p>
                    Snapshot contains {selectedCampaign._count.expectedAssets}{" "}
                    non-disposed assets. Mark each expected asset as found or
                    missing; findings remain pending until reviewed.
                  </p>
                </div>
                {selectedCampaign.status === "OPEN" && (
                  <button
                    className="button"
                    disabled={isPending}
                    onClick={() => finishCampaign(selectedCampaign)}
                    type="button"
                  >
                    Complete after review
                  </button>
                )}
              </div>

              <div className="asset-verification-section">
                <h3>Expected asset snapshot</h3>
                {assetsQuery.isPending ? (
                  <p role="status">Loading expected assets…</p>
                ) : assetsQuery.isError ? (
                  <p className="form-error" role="alert">
                    {campaignError(assetsQuery.error)}
                  </p>
                ) : assetsQuery.data?.items.length ? (
                  <>
                    {assetsQuery.data.items.map((item) => (
                      <article
                        className="asset-verification-item"
                        key={item.id}
                      >
                        <div className="asset-verification-item-heading">
                          <div>
                            <h4>{item.expectedAssetTag}</h4>
                            <p>
                              {item.expectedCategoryCode} ·{" "}
                              {item.expectedLocationCode} —{" "}
                              {item.expectedLocationName} ·{" "}
                              {item.expectedLifecycle} ·{" "}
                              {item.expectedCondition}
                            </p>
                          </div>
                          <Link
                            params={{ assetId: item.assetId }}
                            search={{
                              page: 1,
                              search: "",
                              locationId: item.expectedLocationId,
                              categoryId: "",
                              lifecycle: "",
                              availability: "",
                              condition: "",
                              verification: "",
                              warrantyExpiresOnFrom: "",
                              warrantyExpiresOnTo: "",
                            }}
                            to="/assets/$assetId"
                          >
                            Open asset
                          </Link>
                        </div>
                        {item.observations[0] && (
                          <div className="asset-verification-latest">
                            <strong>
                              {item.observations[0].result.replaceAll("_", " ")}
                            </strong>
                            <span>
                              {resolutionLabel(item.observations[0].resolution)}
                            </span>
                            <ObservationReview
                              disabled={isPending}
                              observation={item.observations[0]}
                              onResolve={reviewObservation}
                            />
                          </div>
                        )}
                        {selectedCampaign.status === "OPEN" && (
                          <VerificationObservationForm
                            campaignLocationId={selectedCampaign.locationId}
                            disabled={isPending}
                            expectedAsset={item}
                            locations={locationsQuery.data ?? []}
                            onRecord={submitObservation}
                          />
                        )}
                      </article>
                    ))}
                    <div className="asset-pagination">
                      <span>
                        {assetsQuery.data.total} expected assets · Page{" "}
                        {assetPage} of{" "}
                        {Math.max(
                          1,
                          Math.ceil(assetsQuery.data.total / pageSize),
                        )}
                      </span>
                      <button
                        className="button button-secondary"
                        disabled={assetPage <= 1 || assetsQuery.isFetching}
                        onClick={() => setAssetPage((current) => current - 1)}
                        type="button"
                      >
                        Previous
                      </button>
                      <button
                        className="button button-secondary"
                        disabled={
                          assetPage >=
                            Math.ceil(assetsQuery.data.total / pageSize) ||
                          assetsQuery.isFetching
                        }
                        onClick={() => setAssetPage((current) => current + 1)}
                        type="button"
                      >
                        Next
                      </button>
                    </div>
                  </>
                ) : (
                  <p>No expected assets are included in this campaign.</p>
                )}
              </div>

              {selectedCampaign.status === "OPEN" && (
                <div className="asset-verification-section">
                  <h3>Unexpected asset observation</h3>
                  <p>
                    Record equipment seen at this location but absent from the
                    campaign snapshot. This does not register or relocate it.
                  </p>
                  <VerificationObservationForm
                    campaignLocationId={selectedCampaign.locationId}
                    disabled={isPending}
                    locations={locationsQuery.data ?? []}
                    onRecord={submitObservation}
                  />
                </div>
              )}

              <div className="asset-verification-section">
                <h3>Recent observations</h3>
                {observationsQuery.isPending ? (
                  <p role="status">Loading observations…</p>
                ) : observationsQuery.isError ? (
                  <p className="form-error" role="alert">
                    {campaignError(observationsQuery.error)}
                  </p>
                ) : observationsQuery.data?.items.length ? (
                  <>
                    <div className="user-table-scroll">
                      <table className="user-table">
                        <thead>
                          <tr>
                            <th>Expected tag</th>
                            <th>Observed tag</th>
                            <th>Result</th>
                            <th>Observed by</th>
                            <th>Observed at</th>
                            <th>Review</th>
                          </tr>
                        </thead>
                        <tbody>
                          {observationsQuery.data.items.map((observation) => (
                            <tr key={observation.id}>
                              <td>
                                {observation.expectedAsset?.expectedAssetTag ??
                                  "Unexpected"}
                              </td>
                              <td>{observation.observedTag ?? "—"}</td>
                              <td>{observation.result.replaceAll("_", " ")}</td>
                              <td>{observation.observedBy.displayName}</td>
                              <td>
                                {new Date(
                                  observation.observedAt,
                                ).toLocaleString()}
                              </td>
                              <td>
                                <ObservationReview
                                  disabled={isPending}
                                  observation={observation}
                                  onResolve={reviewObservation}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="asset-pagination">
                      <span>
                        {observationsQuery.data.total} observations · Page{" "}
                        {observationPage} of{" "}
                        {Math.max(
                          1,
                          Math.ceil(observationsQuery.data.total / pageSize),
                        )}
                      </span>
                      <button
                        className="button button-secondary"
                        disabled={
                          observationPage <= 1 || observationsQuery.isFetching
                        }
                        onClick={() =>
                          setObservationPage((current) => current - 1)
                        }
                        type="button"
                      >
                        Previous
                      </button>
                      <button
                        className="button button-secondary"
                        disabled={
                          observationPage >=
                            Math.ceil(
                              observationsQuery.data.total / pageSize,
                            ) || observationsQuery.isFetching
                        }
                        onClick={() =>
                          setObservationPage((current) => current + 1)
                        }
                        type="button"
                      >
                        Next
                      </button>
                    </div>
                  </>
                ) : (
                  <p>No observations recorded.</p>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
