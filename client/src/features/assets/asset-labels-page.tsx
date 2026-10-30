import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { canManageAssetRegister } from "./asset-access";
import { encodeAssetIdCode39 } from "./asset-code39";
import { assetsApi, type Asset } from "./assets-api";
import { assetIdFromScannedCode } from "./asset-list-search";

function AssetBarcode({ asset }: { asset: Asset }) {
  const encoded = encodeAssetIdCode39(asset.id);
  return (
    <svg
      aria-label={`Code 39 barcode for ${asset.assetTag}`}
      className="asset-label-barcode"
      role="img"
      viewBox={`0 0 ${encoded.width} 28`}
    >
      <title>Asset lookup code for {asset.assetTag}</title>
      <rect fill="white" height="28" width={encoded.width} />
      {encoded.bars.map((bar, index) => (
        <rect
          fill="#172033"
          height="26"
          key={`${bar.x}-${index}`}
          width={bar.width}
          x={bar.x}
          y="1"
        />
      ))}
    </svg>
  );
}

export function AssetLabelsPage() {
  const session = useAuthStore((state) => state.session);
  const generation = useAuthStore((state) => state.generation);
  const identityKey = `${generation}:${session?.user.id ?? ""}:${session?.user.organizationId ?? ""}:${session?.user.role ?? ""}`;

  return <AssetLabelsContent key={identityKey} />;
}

function AssetLabelsContent() {
  const role = useAuthStore((state) => state.session?.user.role);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<Record<string, Asset>>(
    {},
  );
  const assetIdExact = assetIdFromScannedCode(search);
  const assetsQuery = useQuery({
    queryKey: protectedQueryKey("assets", "label-selection", page, search),
    queryFn: () =>
      assetsApi.list({
        page,
        pageSize: 20,
        search: assetIdExact ? undefined : search.trim() || undefined,
        assetIdExact,
      }),
    enabled: canManageAssetRegister(role),
  });
  const selected = Object.values(selectedAssets);
  const pageCount = assetsQuery.data
    ? Math.max(1, Math.ceil(assetsQuery.data.total / assetsQuery.data.pageSize))
    : 1;

  if (!canManageAssetRegister(role)) {
    return (
      <section>
        <div className="page-heading">
          <p className="eyebrow">Hardware</p>
          <h1>Asset labels</h1>
          <p className="page-description">
            Label printing is available to Asset Managers within their assigned
            location scope.
          </p>
        </div>
        <p className="form-error" role="alert">
          Asset Manager access is required.
        </p>
      </section>
    );
  }

  function toggleAsset(asset: Asset) {
    setSelectedAssets((current) => {
      const next = { ...current };
      if (next[asset.id]) delete next[asset.id];
      else next[asset.id] = asset;
      return next;
    });
  }

  return (
    <section className="asset-labels-page">
      <div className="page-heading asset-labels-controls">
        <p className="eyebrow">Hardware · Asset tools</p>
        <h1>Asset labels</h1>
        <p className="page-description">
          Select registered assets to create print-ready labels. The Code 39
          barcode contains only the internal asset ID and resolves through the
          signed-in Asset Register.
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
          Back to Asset Register
        </Link>
      </div>

      <div className="asset-labels-workspace asset-labels-controls">
        <section className="user-admin-card asset-labels-selection">
          <div className="asset-labels-section-heading">
            <div>
              <p className="eyebrow">Scoped asset lookup</p>
              <h2>Select assets</h2>
            </div>
            <span className="master-live-total">
              {selected.length} selected
            </span>
          </div>

          <label className="master-live-search asset-labels-search">
            <span>Search by tag, model, serial, or scanned ID</span>
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search registered assets"
              value={search}
            />
          </label>

          {assetsQuery.isError && (
            <p className="form-error" role="alert">
              {authErrorMessage(assetsQuery.error)}
            </p>
          )}
          {assetsQuery.isPending ? (
            <p className="master-live-state" role="status">
              Loading assets…
            </p>
          ) : assetsQuery.data?.items.length ? (
            <div className="user-table-scroll">
              <table className="user-table asset-labels-table">
                <thead>
                  <tr>
                    <th scope="col">Select</th>
                    <th scope="col">Asset tag</th>
                    <th scope="col">Category</th>
                    <th scope="col">Location</th>
                    <th scope="col">Serial number</th>
                  </tr>
                </thead>
                <tbody>
                  {assetsQuery.data.items.map((asset) => (
                    <tr key={asset.id}>
                      <td>
                        <input
                          aria-label={`Select label for ${asset.assetTag}`}
                          checked={Boolean(selectedAssets[asset.id])}
                          onChange={() => toggleAsset(asset)}
                          type="checkbox"
                        />
                      </td>
                      <td className="master-live-code">{asset.assetTag}</td>
                      <td>{asset.category.name}</td>
                      <td>
                        {asset.location.code} — {asset.location.name}
                      </td>
                      <td>{asset.serialNumber ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : assetsQuery.isError ? null : (
            <p className="master-live-state">No matching assets.</p>
          )}

          {assetsQuery.data && (
            <div className="asset-pagination" aria-label="Asset label pages">
              <span>
                {assetsQuery.data.total} assets · Page {page} of {pageCount}
              </span>
              <button
                className="button button-secondary"
                disabled={page <= 1 || assetsQuery.isFetching}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                Previous
              </button>
              <button
                className="button button-secondary"
                disabled={page >= pageCount || assetsQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </section>

        <aside className="master-live-aside asset-labels-actions">
          <p className="eyebrow">Print sheet</p>
          <h2>
            {selected.length} label{selected.length === 1 ? "" : "s"}
          </h2>
          <p>
            Labels print at 180 × 40 mm. Test the printer scale before using
            labels on equipment.
          </p>
          <button
            className="button"
            disabled={!selected.length}
            onClick={() => window.print()}
            type="button"
          >
            Print selected labels
          </button>
          <button
            className="button button-secondary"
            disabled={!selected.length}
            onClick={() => setSelectedAssets({})}
            type="button"
          >
            Clear selection
          </button>
        </aside>
      </div>

      <section className="asset-labels-sheet">
        <div className="asset-labels-print-heading">
          <h1>IT Asset Labels</h1>
          <p>Scan the Code 39 ID in the signed-in Asset Register.</p>
        </div>
        {selected.map((asset) => (
          <article className="asset-label" key={asset.id}>
            <div className="asset-label-brand">
              <span>IT ASSET</span>
              <strong>{asset.assetTag}</strong>
            </div>
            <AssetBarcode asset={asset} />
            <div className="asset-label-meta">
              <span>{asset.category.name}</span>
              <span>{asset.location.code}</span>
            </div>
          </article>
        ))}
        {!selected.length && (
          <p className="asset-labels-empty">
            Select one or more assets to preview printable labels.
          </p>
        )}
      </section>
    </section>
  );
}
