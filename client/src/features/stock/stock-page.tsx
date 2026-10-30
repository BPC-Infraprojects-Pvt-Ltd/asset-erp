import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { assetsApi } from "../assets/assets-api";
import { canManageAssetRegister } from "../assets/asset-access";
import { locationsApi } from "../locations/locations-api";
import {
  stockApi,
  type CreateStockItemInput,
  type CreateStockMovementInput,
  type CreateStockReservationInput,
  type StockMovementType,
} from "./stock-api";

type MovementDraft = {
  stockItemId: string;
  movementType: StockMovementType;
  sourceStoreId: string;
  destinationStoreId: string;
  quantity: string;
  reason: string;
  sourceReference: string;
};

type ReservationDraft = {
  stockItemId: string;
  storeId: string;
  quantity: string;
  reason: string;
};

function formatStockTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function AccessoriesStockPage() {
  const role = useAuthStore((state) => state.session?.user.role);
  const generation = useAuthStore((state) => state.generation);
  const queryClient = useQueryClient();
  const [stockPage, setStockPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [reservationPage, setReservationPage] = useState(1);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [itemDraft, setItemDraft] = useState<CreateStockItemInput>({
    categoryId: "",
    code: "",
    name: "",
    description: "",
  });
  const [movementDraft, setMovementDraft] = useState<MovementDraft>({
    stockItemId: "",
    movementType: "RECEIPT",
    sourceStoreId: "",
    destinationStoreId: "",
    quantity: "1",
    reason: "",
    sourceReference: "",
  });
  const [reservationDraft, setReservationDraft] =
    useState<ReservationDraft>({
      stockItemId: "",
      storeId: "",
      quantity: "1",
      reason: "",
    });
  const [movementAttempt, setMovementAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [reservationAttempt, setReservationAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const categoriesQuery = useQuery({
    queryKey: protectedQueryKey("asset-categories", "quantity-stock"),
    queryFn: () =>
      assetsApi.listCategories({
        page: 1,
        pageSize: 100,
        trackingMode: "QUANTITY",
      }),
    enabled: canManageAssetRegister(role),
  });
  const storesQuery = useQuery({
    queryKey: protectedQueryKey("stock-stores"),
    queryFn: locationsApi.listStores,
    enabled: canManageAssetRegister(role),
  });
  const itemsQuery = useQuery({
    queryKey: protectedQueryKey("stock-items", stockPage, search),
    queryFn: () =>
      stockApi.listItems({
        page: stockPage,
        pageSize: 20,
        search: search.trim() || undefined,
      }),
    enabled: canManageAssetRegister(role),
  });
  const movementsQuery = useQuery({
    queryKey: protectedQueryKey("stock-movements", movementPage, search),
    queryFn: () =>
      stockApi.listMovements({
        page: movementPage,
        pageSize: 20,
        search: search.trim() || undefined,
      }),
    enabled: canManageAssetRegister(role),
  });
  const reservationsQuery = useQuery({
    queryKey: protectedQueryKey("stock-reservations", reservationPage, search),
    queryFn: () =>
      stockApi.listReservations({
        page: reservationPage,
        pageSize: 20,
        search: search.trim() || undefined,
      }),
    enabled: canManageAssetRegister(role),
  });
  const activeStores = (storesQuery.data ?? []).filter((store) => store.isActive);
  const stockItems = itemsQuery.data?.items ?? [];

  const invalidateStock = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("stock-items"),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("stock-movements"),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("stock-reservations"),
      }),
    ]);
  };
  const createItem = useMutation({
    mutationFn: stockApi.createItem,
    onSuccess: async () => {
      if (useAuthStore.getState().generation !== generation) return;
      setItemDraft({ categoryId: "", code: "", name: "", description: "" });
      setMessageIsError(false);
      setMessage("Stock item created. Balances will appear after a receipt.");
      setStockPage(1);
      await invalidateStock();
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });
  const createMovement = useMutation({
    mutationFn: ({
      stockItemId,
      input,
      key,
    }: {
      stockItemId: string;
      input: CreateStockMovementInput;
      key: string;
    }) => stockApi.createMovement(stockItemId, input, key),
    onSuccess: async () => {
      if (useAuthStore.getState().generation !== generation) return;
      setMovementDraft({
        stockItemId: "",
        movementType: "RECEIPT",
        sourceStoreId: "",
        destinationStoreId: "",
        quantity: "1",
        reason: "",
        sourceReference: "",
      });
      setMovementAttempt(null);
      setMessageIsError(false);
      setMessage("Stock movement recorded.");
      await invalidateStock();
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });
  const createReservation = useMutation({
    mutationFn: ({
      input,
      key,
    }: {
      input: CreateStockReservationInput;
      key: string;
    }) => stockApi.createReservation(input, key),
    onSuccess: async () => {
      if (useAuthStore.getState().generation !== generation) return;
      setReservationDraft({
        stockItemId: "",
        storeId: "",
        quantity: "1",
        reason: "",
      });
      setReservationAttempt(null);
      setMessageIsError(false);
      setMessage("Stock reserved.");
      await invalidateStock();
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });
  const cancelReservation = useMutation({
    mutationFn: ({
      reservationId,
      version,
    }: {
      reservationId: string;
      version: number;
    }) => stockApi.cancelReservation(reservationId, version),
    onSuccess: async () => {
      setMessageIsError(false);
      setMessage("Stock reservation cancelled.");
      await invalidateStock();
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });

  if (!canManageAssetRegister(role)) {
    return (
      <section>
        <div className="page-heading">
          <p className="eyebrow">Hardware</p>
          <h1>Accessories &amp; spare stock</h1>
          <p className="page-description">
            Stock operations are available to Asset Managers within their
            assigned location scope.
          </p>
        </div>
        <p className="form-error" role="alert">
          Asset Manager access is required.
        </p>
      </section>
    );
  }

  const submitItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (
      !itemDraft.categoryId ||
      !itemDraft.code.trim() ||
      !itemDraft.name.trim()
    ) {
      setMessageIsError(true);
      setMessage("Choose a quantity category and enter an item code and name.");
      return;
    }
    createItem.mutate({
      ...itemDraft,
      code: itemDraft.code.trim().toUpperCase(),
      name: itemDraft.name.trim(),
      description: itemDraft.description?.trim() || undefined,
    });
  };

  const submitMovement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const quantity = Number(movementDraft.quantity);
    if (!movementDraft.stockItemId || !Number.isSafeInteger(quantity) || quantity <= 0) {
      setMessageIsError(true);
      setMessage("Choose an item and enter a positive whole-unit quantity.");
      return;
    }
    const needsSource =
      movementDraft.movementType === "ISSUE" ||
      movementDraft.movementType === "TRANSFER";
    const needsDestination =
      movementDraft.movementType === "RECEIPT" ||
      movementDraft.movementType === "RETURN" ||
      movementDraft.movementType === "TRANSFER";
    if (
      (needsSource && !movementDraft.sourceStoreId) ||
      (needsDestination && !movementDraft.destinationStoreId) ||
      (movementDraft.movementType === "TRANSFER" &&
        movementDraft.sourceStoreId === movementDraft.destinationStoreId)
    ) {
      setMessageIsError(true);
      setMessage("Choose distinct source and destination stores as required.");
      return;
    }
    if (!movementDraft.reason.trim()) {
      setMessageIsError(true);
      setMessage("Enter the reason for this stock movement.");
      return;
    }
    const input: CreateStockMovementInput = {
      movementType: movementDraft.movementType,
      ...(needsSource ? { sourceStoreId: movementDraft.sourceStoreId } : {}),
      ...(needsDestination
        ? { destinationStoreId: movementDraft.destinationStoreId }
        : {}),
      quantity,
      reason: movementDraft.reason.trim(),
      sourceReference: movementDraft.sourceReference.trim() || undefined,
    };
    const fingerprint = JSON.stringify({
      stockItemId: movementDraft.stockItemId,
      ...input,
    });
    const key =
      movementAttempt?.fingerprint === fingerprint
        ? movementAttempt.key
        : crypto.randomUUID();
    setMovementAttempt({ fingerprint, key });
    createMovement.mutate({
      stockItemId: movementDraft.stockItemId,
      input,
      key,
    });
  };

  const submitReservation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const quantity = Number(reservationDraft.quantity);
    if (
      !reservationDraft.stockItemId ||
      !reservationDraft.storeId ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      !reservationDraft.reason.trim()
    ) {
      setMessageIsError(true);
      setMessage(
        "Choose an item and store, enter a positive whole-unit quantity, and provide a reason.",
      );
      return;
    }
    const input: CreateStockReservationInput = {
      stockItemId: reservationDraft.stockItemId,
      storeId: reservationDraft.storeId,
      quantity,
      reason: reservationDraft.reason.trim(),
    };
    const fingerprint = JSON.stringify(input);
    const key =
      reservationAttempt?.fingerprint === fingerprint
        ? reservationAttempt.key
        : crypto.randomUUID();
    setReservationAttempt({ fingerprint, key });
    createReservation.mutate({ input, key });
  };

  const setMovementType = (movementType: StockMovementType) => {
    setMovementDraft((current) => ({
      ...current,
      movementType,
      sourceStoreId:
        movementType === "ISSUE" || movementType === "TRANSFER"
          ? current.sourceStoreId
          : "",
      destinationStoreId:
        movementType === "RECEIPT" ||
        movementType === "RETURN" ||
        movementType === "TRANSFER"
          ? current.destinationStoreId
          : "",
    }));
  };

  return (
    <section className="stock-page">
      <div className="page-heading">
        <p className="eyebrow">Hardware · Inventory</p>
        <h1>Accessories &amp; spare stock</h1>
        <p className="page-description">
          Manage quantity-tracked IT accessories by store. Balances are
          calculated from the movement ledger; quantities are whole units only.
        </p>
      </div>

      {message && (
        <p
          className={messageIsError ? "form-error" : "form-notice"}
          role={messageIsError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      {storesQuery.isError && (
        <p className="form-error" role="alert">
          Could not load accessible stores: {authErrorMessage(storesQuery.error)}
        </p>
      )}
      {categoriesQuery.isError && (
        <p className="form-error" role="alert">
          Could not load quantity categories:{" "}
          {authErrorMessage(categoriesQuery.error)}
        </p>
      )}

      <div className="stock-workspace">
        <section className="user-admin-card modern-form-card">
          <div className="form-card-heading">
            <span className="form-step-mark" aria-hidden="true">
              01
            </span>
            <div>
              <p className="eyebrow">Item catalog</p>
              <h2>Create stock item</h2>
              <p>Items use an immutable quantity-tracked category.</p>
            </div>
          </div>
          <form className="modern-form" onSubmit={submitItem}>
            <div className="modern-form-grid master-live-form-grid">
              <label className="modern-field">
                <span>Quantity category</span>
                <select
                  onChange={(event) =>
                    setItemDraft((current) => ({
                      ...current,
                      categoryId: event.target.value,
                    }))
                  }
                  value={itemDraft.categoryId}
                >
                  <option value="">Choose category</option>
                  {(categoriesQuery.data?.items ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.code} · {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modern-field">
                <span>Item code</span>
                <input
                  maxLength={60}
                  onChange={(event) =>
                    setItemDraft((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  value={itemDraft.code}
                />
              </label>
              <label className="modern-field">
                <span>Item name</span>
                <input
                  maxLength={150}
                  onChange={(event) =>
                    setItemDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  value={itemDraft.name}
                />
              </label>
              <label className="modern-field modern-field-wide">
                <span>Description</span>
                <textarea
                  maxLength={1000}
                  onChange={(event) =>
                    setItemDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  value={itemDraft.description}
                />
              </label>
            </div>
            {!categoriesQuery.isPending &&
              !categoriesQuery.data?.items.length && (
                <p className="form-notice">
                  An Administrator must create an active category with
                  quantity tracking before stock items can be added.
                </p>
              )}
            <div className="modern-form-actions master-live-form-actions">
              <div>
                <strong>Quantity-tracked only</strong>
                <small>Unit: whole units; no fractional quantity or conversion.</small>
              </div>
              <button
                className="button"
                disabled={
                  createItem.isPending ||
                  categoriesQuery.isPending ||
                  !categoriesQuery.data?.items.length
                }
                type="submit"
              >
                {createItem.isPending ? "Creating…" : "Create stock item"}
              </button>
            </div>
          </form>
        </section>

        <section className="user-admin-card modern-form-card">
          <div className="form-card-heading">
            <span className="form-step-mark" aria-hidden="true">
              02
            </span>
            <div>
              <p className="eyebrow">Ledger command</p>
              <h2>Record movement</h2>
              <p>Each command creates a durable transaction record.</p>
            </div>
          </div>
          <form className="modern-form" onSubmit={submitMovement}>
            <div className="modern-form-grid master-live-form-grid">
              <label className="modern-field">
                <span>Stock item</span>
                <select
                  onChange={(event) =>
                    setMovementDraft((current) => ({
                      ...current,
                      stockItemId: event.target.value,
                    }))
                  }
                  value={movementDraft.stockItemId}
                >
                  <option value="">Choose item</option>
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modern-field">
                <span>Movement type</span>
                <select
                  onChange={(event) =>
                    setMovementType(event.target.value as StockMovementType)
                  }
                  value={movementDraft.movementType}
                >
                  <option value="RECEIPT">Receipt</option>
                  <option value="ISSUE">Issue</option>
                  <option value="RETURN">Return to stock</option>
                  <option value="TRANSFER">Store transfer</option>
                </select>
              </label>
              {(movementDraft.movementType === "ISSUE" ||
                movementDraft.movementType === "TRANSFER") && (
                <label className="modern-field">
                  <span>Source store</span>
                  <select
                    onChange={(event) =>
                      setMovementDraft((current) => ({
                        ...current,
                        sourceStoreId: event.target.value,
                      }))
                    }
                    value={movementDraft.sourceStoreId}
                  >
                    <option value="">Choose source</option>
                    {activeStores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.code} · {store.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(movementDraft.movementType === "RECEIPT" ||
                movementDraft.movementType === "RETURN" ||
                movementDraft.movementType === "TRANSFER") && (
                <label className="modern-field">
                  <span>Destination store</span>
                  <select
                    onChange={(event) =>
                      setMovementDraft((current) => ({
                        ...current,
                        destinationStoreId: event.target.value,
                      }))
                    }
                    value={movementDraft.destinationStoreId}
                  >
                    <option value="">Choose destination</option>
                    {activeStores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.code} · {store.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="modern-field">
                <span>Quantity (whole units)</span>
                <input
                  max={2147483647}
                  min={1}
                  onChange={(event) =>
                    setMovementDraft((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  step={1}
                  type="number"
                  value={movementDraft.quantity}
                />
              </label>
              <label className="modern-field modern-field-wide">
                <span>Reason</span>
                <input
                  maxLength={500}
                  onChange={(event) =>
                    setMovementDraft((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  value={movementDraft.reason}
                />
              </label>
              <label className="modern-field modern-field-wide">
                <span>Source reference (optional)</span>
                <input
                  maxLength={150}
                  onChange={(event) =>
                    setMovementDraft((current) => ({
                      ...current,
                      sourceReference: event.target.value,
                    }))
                  }
                  value={movementDraft.sourceReference}
                />
              </label>
            </div>
            <div className="modern-form-actions master-live-form-actions">
              <div>
                <strong>No negative available stock</strong>
                <small>
                  Issue and transfer lock and recheck the derived balance.
                </small>
              </div>
              <button
                className="button"
                disabled={createMovement.isPending || !stockItems.length}
                type="submit"
              >
                {createMovement.isPending ? "Posting…" : "Post movement"}
              </button>
            </div>
          </form>
        </section>

        <section className="user-admin-card modern-form-card">
          <div className="form-card-heading">
            <span className="form-step-mark" aria-hidden="true">
              03
            </span>
            <div>
              <p className="eyebrow">Availability hold</p>
              <h2>Reserve stock</h2>
              <p>Reservations reduce derived available quantity.</p>
            </div>
          </div>
          <form className="modern-form" onSubmit={submitReservation}>
            <div className="modern-form-grid master-live-form-grid">
              <label className="modern-field">
                <span>Stock item</span>
                <select
                  onChange={(event) =>
                    setReservationDraft((current) => ({
                      ...current,
                      stockItemId: event.target.value,
                    }))
                  }
                  value={reservationDraft.stockItemId}
                >
                  <option value="">Choose item</option>
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modern-field">
                <span>Store</span>
                <select
                  onChange={(event) =>
                    setReservationDraft((current) => ({
                      ...current,
                      storeId: event.target.value,
                    }))
                  }
                  value={reservationDraft.storeId}
                >
                  <option value="">Choose store</option>
                  {activeStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.code} · {store.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modern-field">
                <span>Quantity (whole units)</span>
                <input
                  max={2147483647}
                  min={1}
                  onChange={(event) =>
                    setReservationDraft((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  step={1}
                  type="number"
                  value={reservationDraft.quantity}
                />
              </label>
              <label className="modern-field modern-field-wide">
                <span>Reason</span>
                <input
                  maxLength={500}
                  onChange={(event) =>
                    setReservationDraft((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  value={reservationDraft.reason}
                />
              </label>
            </div>
            <div className="modern-form-actions master-live-form-actions">
              <div>
                <strong>Availability is authoritative on the server</strong>
                <small>Reservations cannot exceed unreserved stock.</small>
              </div>
              <button
                className="button"
                disabled={createReservation.isPending || !stockItems.length}
                type="submit"
              >
                {createReservation.isPending ? "Reserving…" : "Reserve stock"}
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="user-admin-card">
        <div className="stock-list-heading">
          <div>
            <p className="eyebrow">Derived balance</p>
            <h2>Stock items by store</h2>
          </div>
          {itemsQuery.data && (
            <span className="master-live-total">{itemsQuery.data.total} items</span>
          )}
        </div>
        <label className="master-live-search stock-search">
          <span>Search code, item, or category</span>
          <input
            onChange={(event) => {
              setSearch(event.target.value);
              setStockPage(1);
              setMovementPage(1);
              setReservationPage(1);
            }}
            value={search}
          />
        </label>
        {itemsQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(itemsQuery.error)}
          </p>
        )}
        {itemsQuery.isPending ? (
          <p className="master-live-state" role="status">Loading stock items…</p>
        ) : itemsQuery.data?.items.length ? (
          <div className="user-table-scroll">
            <table className="user-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Store</th>
                  <th scope="col">On hand</th>
                  <th scope="col">Reserved</th>
                  <th scope="col">Available</th>
                </tr>
              </thead>
              <tbody>
                {itemsQuery.data.items.map((item) =>
                  item.balances.length ? (
                    item.balances.map((balance) => (
                      <tr key={`${item.id}:${balance.store.id}`}>
                        <td>
                          <strong>{item.code}</strong>
                          <small>{item.name}</small>
                        </td>
                        <td>{item.category.name}</td>
                        <td>
                          {balance.store.code} · {balance.store.location.name}
                        </td>
                        <td>{balance.onHand} {item.unitLabel}</td>
                        <td>{balance.reserved} {item.unitLabel}</td>
                        <td>
                          <strong>{balance.available} {item.unitLabel}</strong>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.code}</strong>
                        <small>{item.name}</small>
                      </td>
                      <td>{item.category.name}</td>
                      <td colSpan={4}>No stores are assigned to your scope.</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : itemsQuery.isError ? null : (
          <p className="master-live-state">No stock items found.</p>
        )}
        {itemsQuery.data && (
          <div className="asset-pagination" aria-label="Stock item pages">
            <span>
              Page {stockPage} of {pageCount(itemsQuery.data.total, 20)}
            </span>
            <button
              className="button button-secondary"
              disabled={stockPage <= 1 || itemsQuery.isFetching}
              onClick={() => setStockPage((current) => current - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="button button-secondary"
              disabled={
                stockPage >= pageCount(itemsQuery.data.total, 20) ||
                itemsQuery.isFetching
              }
              onClick={() => setStockPage((current) => current + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        )}
      </section>

      <div className="stock-records-grid">
        <section className="user-admin-card">
          <div className="stock-list-heading">
            <div>
              <p className="eyebrow">Transaction ledger</p>
              <h2>Recent movements</h2>
            </div>
          </div>
          {movementsQuery.isError && (
            <p className="form-error" role="alert">
              {authErrorMessage(movementsQuery.error)}
            </p>
          )}
          {movementsQuery.isPending ? (
            <p className="master-live-state" role="status">Loading movements…</p>
          ) : movementsQuery.data?.items.length ? (
            <div className="user-table-scroll">
              <table className="user-table">
                <thead>
                  <tr>
                    <th scope="col">Movement</th>
                    <th scope="col">Item</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Stores</th>
                    <th scope="col">When / reason</th>
                  </tr>
                </thead>
                <tbody>
                  {movementsQuery.data.items.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movement.movementType}</td>
                      <td>{movement.stockItem.code} · {movement.stockItem.name}</td>
                      <td>{movement.quantity} units</td>
                      <td>
                        {movement.sourceStore?.code ?? "—"} →{" "}
                        {movement.destinationStore?.code ?? "—"}
                      </td>
                      <td>
                        {formatStockTime(movement.createdAt)}
                        <small>{movement.reason}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : movementsQuery.isError ? null : (
            <p className="master-live-state">No movements recorded.</p>
          )}
          {movementsQuery.data && (
            <div className="asset-pagination" aria-label="Movement pages">
              <span>
                Page {movementPage} of {pageCount(movementsQuery.data.total, 20)}
              </span>
              <button
                className="button button-secondary"
                disabled={movementPage <= 1 || movementsQuery.isFetching}
                onClick={() => setMovementPage((current) => current - 1)}
                type="button"
              >
                Previous
              </button>
              <button
                className="button button-secondary"
                disabled={
                  movementPage >= pageCount(movementsQuery.data.total, 20) ||
                  movementsQuery.isFetching
                }
                onClick={() => setMovementPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </section>

        <section className="user-admin-card">
          <div className="stock-list-heading">
            <div>
              <p className="eyebrow">Availability holds</p>
              <h2>Reservations</h2>
            </div>
          </div>
          {reservationsQuery.isError && (
            <p className="form-error" role="alert">
              {authErrorMessage(reservationsQuery.error)}
            </p>
          )}
          {reservationsQuery.isPending ? (
            <p className="master-live-state" role="status">Loading reservations…</p>
          ) : reservationsQuery.data?.items.length ? (
            <div className="user-table-scroll">
              <table className="user-table">
                <thead>
                  <tr>
                    <th scope="col">Item / store</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Reason / status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reservationsQuery.data.items.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        {reservation.stockItem.code} · {reservation.store.code}
                      </td>
                      <td>{reservation.quantity} units</td>
                      <td>
                        {reservation.reason}
                        <small>{reservation.status}</small>
                      </td>
                      <td>
                        {reservation.status === "ACTIVE" && (
                          <button
                            className="button button-secondary"
                            disabled={cancelReservation.isPending}
                            onClick={() =>
                              cancelReservation.mutate({
                                reservationId: reservation.id,
                                version: reservation.version,
                              })
                            }
                            type="button"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : reservationsQuery.isError ? null : (
            <p className="master-live-state">No stock reservations found.</p>
          )}
          {reservationsQuery.data && (
            <div className="asset-pagination" aria-label="Reservation pages">
              <span>
                Page {reservationPage} of {pageCount(reservationsQuery.data.total, 20)}
              </span>
              <button
                className="button button-secondary"
                disabled={
                  reservationPage <= 1 || reservationsQuery.isFetching
                }
                onClick={() => setReservationPage((current) => current - 1)}
                type="button"
              >
                Previous
              </button>
              <button
                className="button button-secondary"
                disabled={
                  reservationPage >=
                    pageCount(reservationsQuery.data.total, 20) ||
                  reservationsQuery.isFetching
                }
                onClick={() => setReservationPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
      <p className="stock-policy-note">
        All quantities use whole units. Stock adjustments are intentionally
        unavailable until an approved adjustment authority and workflow are
        defined.
      </p>
    </section>
  );
}
