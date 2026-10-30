import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route } from "../../routes/assets.$assetId";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { canManageAssetRegister, canViewAssetRegister } from "./asset-access";
import { assetsApi } from "./assets-api";
import { formatAssetStatus, formatAssetTimestamp } from "./asset-detail-format";
import { CommissionAssetForm } from "./commission-asset-form";
import { AssetProfileForm } from "./asset-profile-form";
import { AssetRelationshipsPanel } from "./asset-relationships-panel";
import { AssetComponentsPanel } from "./asset-components-panel";

export function AssetDetailPage() {
  const { assetId } = Route.useParams();
  const search = Route.useSearch();
  const role = useAuthStore((state) => state.session?.user.role);
  const generation = useAuthStore((state) => state.generation);
  const assetQuery = useQuery({
    queryKey: protectedQueryKey("asset", assetId),
    queryFn: () => assetsApi.get(assetId),
    enabled: canViewAssetRegister(role),
  });
  const historyQuery = useQuery({
    queryKey: protectedQueryKey("asset-history", assetId),
    queryFn: () => assetsApi.history(assetId),
    enabled: canViewAssetRegister(role),
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
            warrantyExpiresOnFrom:
              current.warrantyExpiresOnFrom ??
              search.warrantyExpiresOnFrom ??
              "",
            warrantyExpiresOnTo:
              current.warrantyExpiresOnTo ?? search.warrantyExpiresOnTo ?? "",
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
        {assetQuery.data && canManageAssetRegister(role) && (
          <Link
            className="button button-secondary"
            search={{ assetId: assetQuery.data.id }}
            to="/retirements"
          >
            Submit retirement request
          </Link>
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
          {role === "ADMINISTRATOR" && (
            <p className="asset-history-unavailable" role="note">
              Administrator view is read-only. Asset Managers handle asset
              registration, commissioning, and profile updates.
            </p>
          )}
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
              <div>
                <dt>Criticality</dt>
                <dd>{assetQuery.data.criticality ?? "Not set"}</dd>
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
          {assetQuery.data.category.specificationFields.length > 0 && (
            <section
              className="user-admin-card"
              aria-label="Category-specific specifications"
            >
              <h2>Specifications</h2>
              <dl className="asset-details">
                {assetQuery.data.category.specificationFields.map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>
                      {assetQuery.data.specifications?.[field.key] ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
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
              <div>
                <dt>Commissioning date</dt>
                <dd>
                  {assetQuery.data.commissioningDate?.slice(0, 10) ?? "—"}
                </dd>
              </div>
              <div>
                <dt>Purchase date</dt>
                <dd>{assetQuery.data.purchaseDate?.slice(0, 10) ?? "—"}</dd>
              </div>
              <div>
                <dt>Warranty expiry</dt>
                <dd>
                  {assetQuery.data.warrantyExpiresOn?.slice(0, 10) ?? "—"}
                </dd>
              </div>
              <div>
                <dt>Warranty/support reference</dt>
                <dd>{assetQuery.data.warrantyReference ?? "—"}</dd>
              </div>
              <div className="asset-detail-notes">
                <dt>Notes</dt>
                <dd>{assetQuery.data.notes ?? "—"}</dd>
              </div>
            </dl>
          </section>
          <AssetRelationshipsPanel
            asset={assetQuery.data}
            editable={canManageAssetRegister(role)}
          />
          <AssetComponentsPanel
            asset={assetQuery.data}
            editable={canManageAssetRegister(role)}
          />
          <section
            className="user-admin-card"
            aria-label="Custody and movement history"
          >
            <h2>Asset history</h2>
            <p>
              Registration, commissioning, profile, relationship, reservation,
              assignment/return, transfer, and component install/removal events
              are recorded here. Repair, verification, and retirement events
              remain future work.
            </p>
            {historyQuery.isPending && (
              <p role="status">Loading asset history…</p>
            )}
            {historyQuery.isError && (
              <p className="form-error" role="alert">
                {authErrorMessage(historyQuery.error)}
              </p>
            )}
            {historyQuery.data?.length ? (
              <ol className="asset-history-timeline">
                {historyQuery.data.map((event) => (
                  <li key={event.id}>
                    <time dateTime={event.occurredAt}>
                      {formatAssetTimestamp(event.occurredAt)}
                    </time>
                    <div>
                      <strong>
                        {event.eventType === "REGISTERED"
                          ? "Asset registered as received"
                          : event.eventType === "COMMISSIONED"
                            ? `Asset commissioned${event.details?.commissioningDate ? ` on ${event.details.commissioningDate}` : ""}`
                            : event.eventType === "RELATIONSHIP_ADDED"
                              ? `Linked ${event.details?.role?.toLowerCase() ?? "related"} asset`
                              : event.eventType === "RELATIONSHIP_REMOVED"
                                ? `Ended ${event.details?.role?.toLowerCase() ?? "related"} asset link`
                                : event.eventType === "COMPONENT_INSTALLED"
                                  ? `Component installed${event.details?.componentAssetId || event.details?.hostAssetId ? ` · ${event.details.componentAssetId ?? event.details.hostAssetId}` : ""}`
                                  : event.eventType === "COMPONENT_REMOVED"
                                    ? `Component removed${event.details?.componentAssetId || event.details?.hostAssetId ? ` · ${event.details.componentAssetId ?? event.details.hostAssetId}` : ""}`
                                    : event.eventType ===
                                        "VERIFICATION_RECONCILED"
                                      ? `Verification reconciled: ${event.details?.verification?.replaceAll("_", " ") ?? "reviewed"}`
                                      : event.eventType ===
                                          "RETIREMENT_REQUESTED"
                                        ? "Retirement request submitted for review"
                                        : event.details?.fields?.length
                                          ? `Profile fields updated: ${event.details.fields.join(", ")}`
                                          : "Asset profile saved"}
                      </strong>
                      <span>By {event.actor.displayName}</span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : historyQuery.isError || historyQuery.isPending ? null : (
              <p className="asset-history-unavailable">
                No asset history events have been recorded yet.
              </p>
            )}
          </section>
        </>
      )}
      {assetQuery.data &&
        assetQuery.data.lifecycle === "RECEIVED" &&
        canManageAssetRegister(role) && (
          <CommissionAssetForm
            key={`${generation}:${assetId}:commission`}
            asset={assetQuery.data}
          />
        )}
      {assetQuery.data && canManageAssetRegister(role) && (
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
