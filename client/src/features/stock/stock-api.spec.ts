import type { AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { apiClient } from "../../lib/api/client";
import { stockApi } from "./stock-api";

describe("stock API", () => {
  const originalAdapter = apiClient.defaults.adapter;

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it("requests paged stock balances from the live ledger endpoint", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/stock/items");
      expect(config.params).toEqual({
        page: 2,
        pageSize: 20,
        search: "adapter",
      });
      return {
        data: { items: [], page: 2, pageSize: 20, total: 0 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      stockApi.listItems({ page: 2, pageSize: 20, search: "adapter" }),
    ).resolves.toEqual({ items: [], page: 2, pageSize: 20, total: 0 });
  });

  it("posts a stock movement with an idempotency key", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/stock/items/item-id/movements");
      expect(config.headers.get("Idempotency-Key")).toBe("movement-retry-key");
      const body =
        typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      expect(body).toMatchObject({
        movementType: "RECEIPT",
        destinationStoreId: "store-id",
        quantity: 3,
      });
      return {
        data: { id: "movement-id" },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      stockApi.createMovement(
        "item-id",
        {
          movementType: "RECEIPT",
          destinationStoreId: "store-id",
          quantity: 3,
          reason: "Opening receipt",
        },
        "movement-retry-key",
      ),
    ).resolves.toEqual({ id: "movement-id" });
  });

  it("cancels a reservation with the server version", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/stock/reservations/reservation-id/cancel");
      expect(config.headers.get("If-Match")).toBe('"4"');
      return {
        data: { id: "reservation-id", status: "CANCELLED" },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      stockApi.cancelReservation("reservation-id", 4),
    ).resolves.toEqual({ id: "reservation-id", status: "CANCELLED" });
  });
});
