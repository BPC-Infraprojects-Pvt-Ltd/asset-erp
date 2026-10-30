import { apiClient } from "../../lib/api/client";
import type { AssetCategory } from "../assets/assets-api";

export type StockMovementType = "RECEIPT" | "ISSUE" | "RETURN" | "TRANSFER";

export interface StockStore {
  id: string;
  code: string;
  name: string;
  location: { id: string; code: string; name: string };
}

export interface StockBalance {
  store: StockStore;
  onHand: number;
  reserved: number;
  available: number;
}

export interface StockItemBase {
  id: string;
  organizationId: string;
  categoryId: string;
  code: string;
  name: string;
  description: string | null;
  createdByUserId: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  category: Pick<AssetCategory, "id" | "code" | "name" | "trackingMode">;
}

export interface StockItem extends StockItemBase {
  unitLabel: "units";
  balances: StockBalance[];
}

export interface StockMovement {
  id: string;
  organizationId: string;
  stockItemId: string;
  movementType: StockMovementType;
  sourceStoreId: string | null;
  destinationStoreId: string | null;
  quantity: number;
  reason: string;
  sourceReference: string | null;
  createdByUserId: string;
  createdAt: string;
  stockItem: Pick<StockItem, "id" | "code" | "name">;
  sourceStore: StockStore | null;
  destinationStore: StockStore | null;
  createdBy: { id: string; displayName: string };
}

export interface StockReservation {
  id: string;
  organizationId: string;
  stockItemId: string;
  storeId: string;
  quantity: number;
  reason: string;
  createdByUserId: string;
  cancelledByUserId: string | null;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  status: "ACTIVE" | "CANCELLED";
  stockItem: Pick<StockItem, "id" | "code" | "name">;
  store: StockStore;
}

export interface PagedStockRecords<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface StockListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface StockMovementListQuery extends StockListQuery {
  stockItemId?: string;
  storeId?: string;
  movementType?: StockMovementType;
}

export interface StockReservationListQuery extends StockListQuery {
  stockItemId?: string;
  storeId?: string;
}

export interface CreateStockItemInput {
  categoryId: string;
  code: string;
  name: string;
  description?: string;
}

export interface CreateStockMovementInput {
  movementType: StockMovementType;
  sourceStoreId?: string;
  destinationStoreId?: string;
  quantity: number;
  reason: string;
  sourceReference?: string;
}

export interface CreateStockReservationInput {
  stockItemId: string;
  storeId: string;
  quantity: number;
  reason: string;
}

export const stockApi = {
  async listItems(
    query: StockListQuery,
  ): Promise<PagedStockRecords<StockItem>> {
    const { data } = await apiClient.get<PagedStockRecords<StockItem>>(
      "/stock/items",
      { params: query },
    );
    return data;
  },

  async createItem(input: CreateStockItemInput): Promise<StockItemBase> {
    const { data } = await apiClient.post<StockItemBase>("/stock/items", input);
    return data;
  },

  async listMovements(
    query: StockMovementListQuery,
  ): Promise<PagedStockRecords<StockMovement>> {
    const { data } = await apiClient.get<PagedStockRecords<StockMovement>>(
      "/stock/movements",
      { params: query },
    );
    return data;
  },

  async createMovement(
    stockItemId: string,
    input: CreateStockMovementInput,
    idempotencyKey: string,
  ): Promise<StockMovement> {
    const { data } = await apiClient.post<StockMovement>(
      `/stock/items/${stockItemId}/movements`,
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  async listReservations(
    query: StockReservationListQuery,
  ): Promise<PagedStockRecords<StockReservation>> {
    const { data } = await apiClient.get<PagedStockRecords<StockReservation>>(
      "/stock/reservations",
      { params: query },
    );
    return data;
  },

  async createReservation(
    input: CreateStockReservationInput,
    idempotencyKey: string,
  ): Promise<StockReservation> {
    const { data } = await apiClient.post<StockReservation>(
      "/stock/reservations",
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  async cancelReservation(
    reservationId: string,
    version: number,
  ): Promise<StockReservation> {
    const { data } = await apiClient.post<StockReservation>(
      `/stock/reservations/${reservationId}/cancel`,
      undefined,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },
};
