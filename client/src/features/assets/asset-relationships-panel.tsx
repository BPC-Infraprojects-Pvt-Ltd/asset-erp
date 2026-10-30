import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey } from "../auth/auth-store";
import { assetsApi, type Asset } from "./assets-api";

export function AssetRelationshipsPanel({
  asset,
  editable,
}: {
  asset: Asset;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const relationshipsQuery = useQuery({
    queryKey: protectedQueryKey("asset-relationships", asset.id),
    queryFn: () => assetsApi.relationships(asset.id),
  });
  const candidatesQuery = useQuery({
    queryKey: protectedQueryKey(
      "asset-relationship-candidates",
      asset.id,
      search,
    ),
    queryFn: () =>
      assetsApi.list({
        page: 1,
        pageSize: 10,
        search: search.trim() || undefined,
      }),
    enabled: editable && search.trim().length >= 2,
  });
  const addRelationship = useMutation({
    mutationFn: (childAssetId: string) =>
      assetsApi.addChildRelationship(asset.id, childAssetId),
    onSuccess: async () => {
      setSearch("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("asset-relationships", asset.id),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("asset-history", asset.id),
        }),
      ]);
    },
  });
  const endRelationship = useMutation({
    mutationFn: (relationshipId: string) =>
      assetsApi.endRelationship(asset.id, relationshipId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("asset-relationships", asset.id),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("asset-history", asset.id),
        }),
      ]);
    },
  });
  const relationships = relationshipsQuery.data ?? [];
  const linkedAssetIds = new Set(
    relationships.flatMap((relationship) => [
      relationship.parentAssetId,
      relationship.childAssetId,
    ]),
  );
  const errors = [
    relationshipsQuery.error,
    candidatesQuery.error,
    addRelationship.error,
    endRelationship.error,
  ].filter(Boolean);

  return (
    <section
      className="user-admin-card asset-relationships-card"
      aria-label="Parent and child asset relationships"
    >
      <div className="asset-relationships-heading">
        <div>
          <p className="eyebrow">Equipment structure</p>
          <h2>Parent &amp; child assets</h2>
        </div>
        <span className="master-live-total">{relationships.length} linked</span>
      </div>
      <p className="asset-relationships-description">
        Link a bundled or installed asset to its parent. Links are ended, not
        deleted, so the relationship history remains available.
      </p>

      {errors.map((error, index) => (
        <p className="form-error" key={index} role="alert">
          {authErrorMessage(error)}
        </p>
      ))}
      {relationshipsQuery.isPending ? (
        <p className="master-live-state" role="status">
          Loading asset relationships…
        </p>
      ) : relationships.length ? (
        <ul className="asset-relationship-list">
          {relationships.map((relationship) => {
            const isParent = relationship.parentAssetId === asset.id;
            const relatedAsset = isParent
              ? relationship.childAsset
              : relationship.parentAsset;
            return (
              <li key={relationship.id}>
                <span className="asset-relationship-role">
                  {isParent ? "Child asset" : "Parent asset"}
                </span>
                <div>
                  <strong>{relatedAsset.assetTag}</strong>
                  <span>
                    {relatedAsset.category.code} — {relatedAsset.category.name}
                  </span>
                </div>
                {editable && (
                  <button
                    className="button button-secondary"
                    disabled={
                      endRelationship.isPending || addRelationship.isPending
                    }
                    onClick={() => endRelationship.mutate(relationship.id)}
                    type="button"
                  >
                    End link
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="asset-history-unavailable">
          No active parent or child asset links.
        </p>
      )}

      {editable && (
        <div className="asset-relationship-add">
          <label className="master-live-search">
            <span>Add child asset</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search asset tag, serial, or model"
              value={search}
            />
          </label>
          {candidatesQuery.isPending && search.trim().length >= 2 && (
            <p role="status">Searching assets…</p>
          )}
          {candidatesQuery.data?.items
            .filter(
              (candidate) =>
                candidate.id !== asset.id && !linkedAssetIds.has(candidate.id),
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
                    addRelationship.isPending || endRelationship.isPending
                  }
                  onClick={() => addRelationship.mutate(candidate.id)}
                  type="button"
                >
                  {addRelationship.isPending ? "Linking…" : "Add child"}
                </button>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
