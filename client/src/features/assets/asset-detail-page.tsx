import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route } from "../../routes/assets.$assetId";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { assetsApi } from "./assets-api";
import { formatAssetStatus, formatAssetTimestamp } from "./asset-detail-format";
import { AssetProfileForm } from "./asset-profile-form";

export function AssetDetailPage() {
  const { assetId } = Route.useParams();
  const search = Route.useSearch();
  const role = useAuthStore((state) => state.session?.user.role);
  const generation = useAuthStore((state) => state.generation);
  const assetQuery = useQuery({
    queryKey: protectedQueryKey("asset", assetId),
    queryFn: () => assetsApi.get(assetId),
    enabled: role === "ASSET_MANAGER",
  });

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Hardware</p>
        <Link
          search={(current) => ({
            page: current.page ?? search.page ?? 1,
            search: current.search ?? search.search ?? "",
            locationId: current.locationId ?? search.locationId ?? "",
            categoryId: current.categoryId ?? search.categoryId ?? "",
            lifecycle: current.lifecycle ?? search.lifecycle ?? "",
            availability: current.availability ?? search.availability ?? "",
            condition: current.condition ?? search.condition ?? "",
            verification: current.verification ?? search.verification ?? "",
          })}
          to="/assets"
        >
          Back to asset register
        </Link>
        <h1>{assetQuery.data?.assetTag ?? "Asset details"}</h1>
        {assetQuery.data && (
          <p>
            {assetQuery.data.category.name} · {assetQuery.data.location.name}
          </p>
        )}
      </div>
      {assetQuery.isPending && <p role="status">Loading asset…</p>}
      {assetQuery.isError && (
        <p className="form-error" role="alert">
          {authErrorMessage(assetQuery.error)}
        </p>
      )}
      {assetQuery.data && (
        <>
          <section
            className="user-admin-card"
            aria-label="Asset identification"
          >
            <h2>Identification</h2>
            <dl className="asset-details">
              <div>
                <dt>Asset tag</dt>
                <dd>{assetQuery.data.assetTag}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>
                  {assetQuery.data.category.code} —{" "}
                  {assetQuery.data.category.name}
                </dd>
              </div>
              <div>
                <dt>Manufacturer</dt>
                <dd>{assetQuery.data.manufacturer ?? "—"}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{assetQuery.data.model ?? "—"}</dd>
              </div>
              <div>
                <dt>Serial number</dt>
                <dd>{assetQuery.data.serialNumber ?? "—"}</dd>
              </div>
            </dl>
          </section>
          <section className="user-admin-card" aria-label="Operational state">
            <h2>Operational state</h2>
            <dl className="asset-details">
              <div>
                <dt>Lifecycle</dt>
                <dd>{formatAssetStatus(assetQuery.data.lifecycle)}</dd>
              </div>
              <div>
                <dt>Availability</dt>
                <dd>{formatAssetStatus(assetQuery.data.availability)}</dd>
              </div>
              <div>
                <dt>Condition</dt>
                <dd>{formatAssetStatus(assetQuery.data.condition)}</dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd>{formatAssetStatus(assetQuery.data.verification)}</dd>
              </div>
              <div>
                <dt>Confirmed location</dt>
                <dd>
                  {assetQuery.data.location.code} —{" "}
                  {assetQuery.data.location.name}
                </dd>
              </div>
            </dl>
          </section>
          <section className="user-admin-card" aria-label="Record information">
            <h2>Record information</h2>
            <dl className="asset-details">
              <div>
                <dt>Source reference</dt>
                <dd>{assetQuery.data.sourceReference ?? "—"}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatAssetTimestamp(assetQuery.data.createdAt)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatAssetTimestamp(assetQuery.data.updatedAt)}</dd>
              </div>
              <div>
                <dt>Record version</dt>
                <dd>{assetQuery.data.version}</dd>
              </div>
              <div className="asset-detail-notes">
                <dt>Notes</dt>
                <dd>{assetQuery.data.notes ?? "—"}</dd>
              </div>
            </dl>
          </section>
          <section
            className="user-admin-card"
            aria-label="Custody and movement history"
          >
            <h2>Custody and movement history</h2>
            <p className="asset-history-unavailable" role="status">
              History is not available yet. Assignment and movement records will
              appear here after their approved workflows are implemented. This
              does not indicate that the asset has never been assigned or moved.
            </p>
          </section>
        </>
      )}
      {assetQuery.data && role === "ASSET_MANAGER" && (
        <AssetProfileForm
          key={`${generation}:${assetId}`}
          asset={assetQuery.data}
          reload={async () => {
            const result = await assetQuery.refetch({ throwOnError: true });
            if (!result.data)
              throw new Error("The latest asset was not returned.");
            return result.data;
          }}
        />
      )}
    </section>
  );
}
