import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import {
  assetsApi,
  type Asset,
  type AssetComponentInstallation,
} from "./assets-api";

function formatInstallDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AssetComponentsPanel({
  asset,
  editable,
}: {
  asset: Asset;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const generation = useAuthStore((state) => state.generation);
  const [search, setSearch] = useState("");
  const [installNote, setInstallNote] = useState("");
  const [removalNotes, setRemovalNotes] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const installationsQuery = useQuery({
    queryKey: protectedQueryKey("asset-components", asset.id),
    queryFn: () => assetsApi.componentInstallations(asset.id),
  });
  const relationshipsQuery = useQuery({
    queryKey: protectedQueryKey("asset-relationships", asset.id),
    queryFn: () => assetsApi.relationships(asset.id),
  });
  const candidatesQuery = useQuery({
    queryKey: protectedQueryKey("asset-component-candidates", asset.id, search),
    queryFn: () =>
      assetsApi.list({
        page: 1,
        pageSize: 20,
        lifecycle: "ACTIVE",
        availability: "AVAILABLE",
        search: search.trim() || undefined,
      }),
    enabled:
      editable &&
      asset.lifecycle === "ACTIVE" &&
      asset.availability === "AVAILABLE" &&
      search.trim().length >= 2,
  });
  const activeInstallations = (installationsQuery.data ?? []).filter(
    (installation) => !installation.removedAt,
  );
  const activeHostInstallations = activeInstallations.filter(
    (installation) => installation.hostAssetId === asset.id,
  );
  const currentHostInstallation = activeInstallations.find(
    (installation) => installation.componentAssetId === asset.id,
  );
  const canInstall =
    editable &&
    asset.lifecycle === "ACTIVE" &&
    asset.availability === "AVAILABLE";
  const installedAssetIds = new Set(
    activeInstallations.map((installation) => installation.componentAssetId),
  );
  const linkedAssetIds = new Set(
    (relationshipsQuery.data ?? []).flatMap((relationship) => [
      relationship.parentAssetId,
      relationship.childAssetId,
    ]),
  );

  const invalidateComponentData = async (componentAssetId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("asset-components", asset.id),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("asset-history", asset.id),
      }),
      ...(componentAssetId
        ? [
            queryClient.invalidateQueries({
              queryKey: protectedQueryKey("asset-components", componentAssetId),
            }),
            queryClient.invalidateQueries({
              queryKey: protectedQueryKey("asset-history", componentAssetId),
            }),
          ]
        : []),
    ]);
  };
  const installComponent = useMutation({
    mutationFn: ({
      componentAssetId,
      key,
    }: {
      componentAssetId: string;
      key: string;
    }) =>
      assetsApi.installComponent(
        asset.id,
        {
          componentAssetId,
          installNote: installNote.trim() || undefined,
        },
        key,
      ),
    onSuccess: async (installation) => {
      if (useAuthStore.getState().generation !== generation) return;
      setSearch("");
      setInstallNote("");
      const fingerprint = JSON.stringify({
        hostAssetId: asset.id,
        componentAssetId: installation.componentAssetId,
        installNote: installation.installNote?.trim() || null,
      });
      setAttempts((current) => {
        const next = { ...current };
        delete next[fingerprint];
        return next;
      });
      setMessageIsError(false);
      setMessage("Component installation recorded.");
      await Promise.all([
        invalidateComponentData(installation.componentAssetId),
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
  const removeComponent = useMutation({
    mutationFn: ({
      installation,
      key,
    }: {
      installation: AssetComponentInstallation;
      key: string;
    }) =>
      assetsApi.removeComponent(
        asset.id,
        installation.id,
        installation.version,
        key,
        {
          removalNote: removalNotes[installation.id]?.trim() || undefined,
        },
      ),
    onSuccess: async (installation) => {
      setMessageIsError(false);
      setMessage("Component removal recorded.");
      const fingerprint = JSON.stringify({
        installationId: installation.id,
        version: installation.version - 1,
        removalNote: installation.removalNote?.trim() || null,
      });
      setAttempts((current) => {
        const next = { ...current };
        delete next[fingerprint];
        return next;
      });
      setRemovalNotes((current) => ({
        ...current,
        [installation.id]: "",
      }));
      await invalidateComponentData(installation.componentAssetId);
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });
  const errors = [
    installationsQuery.error,
    relationshipsQuery.error,
    candidatesQuery.error,
  ].filter(Boolean);

  const addComponent = (component: Asset) => {
    setMessage(null);
    const fingerprint = JSON.stringify({
      hostAssetId: asset.id,
      componentAssetId: component.id,
      installNote: installNote.trim() || null,
    });
    const key = attempts[fingerprint] ?? crypto.randomUUID();
    setAttempts((current) => ({ ...current, [fingerprint]: key }));
    installComponent.mutate({ componentAssetId: component.id, key });
  };

  const endInstallation = (installation: AssetComponentInstallation) => {
    setMessage(null);
    const fingerprint = JSON.stringify({
      installationId: installation.id,
      version: installation.version,
      removalNote: removalNotes[installation.id]?.trim() || null,
    });
    const key = attempts[fingerprint] ?? crypto.randomUUID();
    setAttempts((current) => ({ ...current, [fingerprint]: key }));
    removeComponent.mutate({ installation, key });
  };

  return (
    <section
      className="user-admin-card asset-components-card"
      aria-label="Installed asset components"
    >
      <div className="asset-relationships-heading">
        <div>
          <p className="eyebrow">Equipment configuration</p>
          <h2>Installed components</h2>
        </div>
        <span className="master-live-total">
          {currentHostInstallation
            ? `Installed in ${currentHostInstallation.hostAsset.assetTag}`
            : `${activeHostInstallations.length} installed`}
        </span>
      </div>
      <p className="asset-relationships-description">
        Installation is a separate historical record. It does not change
        availability, custody, or confirmed location; remove a component before
        moving or issuing it independently.
      </p>
      {message && (
        <p
          className={messageIsError ? "form-error" : "form-notice"}
          role={messageIsError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      {errors.map((error, index) => (
        <p className="form-error" key={index} role="alert">
          {authErrorMessage(error)}
        </p>
      ))}
      {installationsQuery.isPending ? (
        <p className="master-live-state" role="status">
          Loading installed components…
        </p>
      ) : installationsQuery.data?.length ? (
        <ul className="asset-component-list">
          {installationsQuery.data.map((installation) => {
            const isHost = installation.hostAssetId === asset.id;
            const relatedAsset = isHost
              ? installation.componentAsset
              : installation.hostAsset;
            const active = !installation.removedAt;
            return (
              <li key={installation.id}>
                <div className="asset-component-summary">
                  <span
                    className={
                      active
                        ? "asset-component-status active"
                        : "asset-component-status removed"
                    }
                  >
                    {active ? "Installed" : "Removed"}
                  </span>
                  <div>
                    <Link
                      params={{ assetId: relatedAsset.id }}
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
                    >
                      {relatedAsset.assetTag}
                    </Link>
                    <small>
                      {relatedAsset.category.code} ·{" "}
                      {relatedAsset.location.code}
                    </small>
                  </div>
                  <small>
                    {isHost ? "Component" : "Installed in"} ·{" "}
                    {formatInstallDate(
                      active
                        ? installation.installedAt
                        : installation.removedAt!,
                    )}
                  </small>
                </div>
                {active && installation.installNote && (
                  <p>{installation.installNote}</p>
                )}
                {!active && installation.removalNote && (
                  <p>{installation.removalNote}</p>
                )}
                {editable &&
                  active &&
                  isHost &&
                  installation.hostAsset.availability === "AVAILABLE" && (
                    <div className="asset-component-remove">
                      <input
                        aria-label={`Removal note for ${relatedAsset.assetTag}`}
                        maxLength={1000}
                        onChange={(event) =>
                          setRemovalNotes((current) => ({
                            ...current,
                            [installation.id]: event.target.value,
                          }))
                        }
                        placeholder="Removal note (optional)"
                        value={removalNotes[installation.id] ?? ""}
                      />
                      <button
                        className="button button-secondary"
                        disabled={removeComponent.isPending}
                        onClick={() => endInstallation(installation)}
                        type="button"
                      >
                        {removeComponent.isPending
                          ? "Removing…"
                          : "Record removal"}
                      </button>
                    </div>
                  )}
              </li>
            );
          })}
        </ul>
      ) : installationsQuery.isError ? null : (
        <p className="asset-history-unavailable">
          No component installations have been recorded.
        </p>
      )}
      {canInstall ? (
        <div className="asset-component-add">
          <label className="master-live-search">
            <span>Install an individually tracked component</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search at least 2 characters"
              value={search}
            />
          </label>
          <label className="modern-field">
            <span>Installation note (optional)</span>
            <input
              maxLength={1000}
              onChange={(event) => setInstallNote(event.target.value)}
              value={installNote}
            />
          </label>
          {candidatesQuery.data?.items
            .filter(
              (candidate) =>
                candidate.id !== asset.id &&
                !installedAssetIds.has(candidate.id) &&
                !linkedAssetIds.has(candidate.id),
            )
            .map((candidate) => (
              <div className="asset-relationship-candidate" key={candidate.id}>
                <span>
                  <strong>{candidate.assetTag}</strong>
                  <small>
                    {candidate.category.name} · {candidate.location.code}
                  </small>
                </span>
                <button
                  className="button button-secondary"
                  disabled={
                    installComponent.isPending || removeComponent.isPending
                  }
                  onClick={() => addComponent(candidate)}
                  type="button"
                >
                  {installComponent.isPending
                    ? "Installing…"
                    : "Record installation"}
                </button>
              </div>
            ))}
        </div>
      ) : editable ? (
        <p className="asset-history-unavailable">
          Components can be installed only while the host asset is active and
          available.
        </p>
      ) : null}
    </section>
  );
}
