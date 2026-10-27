import { useQuery } from "@tanstack/react-query";
import { Route } from "../../routes/assets.$assetId";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { assetsApi } from "./assets-api";

export function AssetDetailPage() {
  const { assetId } = Route.useParams();
  const role = useAuthStore((state) => state.session?.user.role);
  const assetQuery = useQuery({
    queryKey: protectedQueryKey("asset", assetId),
    queryFn: () => assetsApi.get(assetId),
    enabled: role === "ASSET_MANAGER",
  });

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Hardware</p>
        <h1>Asset details</h1>
      </div>
      {assetQuery.isPending && <p role="status">Loading asset…</p>}
      {assetQuery.isError && (
        <p className="form-error" role="alert">
          {authErrorMessage(assetQuery.error)}
        </p>
      )}
      {assetQuery.data && (
        <section className="user-admin-card" aria-label="Asset profile">
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
            <div>
              <dt>Confirmed location</dt>
              <dd>
                {assetQuery.data.location.code} —{" "}
                {assetQuery.data.location.name}
              </dd>
            </div>
            <div>
              <dt>Lifecycle</dt>
              <dd>{assetQuery.data.lifecycle}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{assetQuery.data.availability.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Condition</dt>
              <dd>{assetQuery.data.condition}</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>{assetQuery.data.verification.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Source reference</dt>
              <dd>{assetQuery.data.sourceReference ?? "—"}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{assetQuery.data.notes ?? "—"}</dd>
            </div>
          </dl>
        </section>
      )}
    </section>
  );
}
