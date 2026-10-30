import type { AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { apiClient } from "../../lib/api/client";
import { assetsApi } from "./assets-api";

describe("asset category lifecycle API", () => {
  const originalAdapter = apiClient.defaults.adapter;

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it("requests inactive categories explicitly", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/assets/categories");
      expect(config.params).toEqual({
        page: 1,
        pageSize: 20,
        includeInactive: true,
      });
      return {
        data: { items: [], page: 1, pageSize: 20, total: 0 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetsApi.listCategories({
        page: 1,
        pageSize: 20,
        includeInactive: true,
      }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it("filters categories by the hardware tracking mode", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/assets/categories");
      expect(config.params).toEqual({
        page: 1,
        pageSize: 100,
        trackingMode: "QUANTITY",
      });
      return {
        data: { items: [], page: 1, pageSize: 100, total: 0 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetsApi.listCategories({
        page: 1,
        pageSize: 100,
        trackingMode: "QUANTITY",
      }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 100, total: 0 });
  });

  it("loads a category by ID to review its latest server version", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/assets/categories/category-id");
      return {
        data: { id: "category-id", version: 3, isActive: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(assetsApi.getCategory("category-id")).resolves.toEqual({
      id: "category-id",
      version: 3,
      isActive: true,
    });
  });

  it.each([
    ["deactivate", false],
    ["reactivate", true],
  ] as const)(
    "uses the explicit %s category command",
    async (action, isActive) => {
      const adapter: AxiosAdapter = async (config) => {
        expect(config.method).toBe("post");
        expect(config.url).toBe(`/assets/categories/category-id/${action}`);
        return {
          data: { id: "category-id", isActive },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };
      apiClient.defaults.adapter = adapter;

      await expect(
        assetsApi.setCategoryActive("category-id", isActive),
      ).resolves.toEqual({ id: "category-id", isActive });
    },
  );

  it("updates complete category profiles with the quoted current version", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("put");
      expect(config.url).toBe("/assets/categories/category-id");
      expect(config.headers.get("If-Match")).toBe('"4"');
      expect(JSON.parse(config.data as string)).toEqual({
        code: "LAPTOP",
        name: "Laptop",
      });
      return {
        data: { id: "category-id", version: 5 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetsApi.updateCategory("category-id", 4, {
        code: "LAPTOP",
        name: "Laptop",
      }),
    ).resolves.toEqual({ id: "category-id", version: 5 });
  });

  it("requests exact serial matches through the shared asset list API", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/assets");
      expect(config.params).toEqual({
        page: 1,
        pageSize: 5,
        serialNumberExact: "000123",
        verification: "MISSING",
      });
      return {
        data: { items: [], page: 1, pageSize: 5, total: 0 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetsApi.list({
        page: 1,
        pageSize: 5,
        serialNumberExact: "000123",
        verification: "MISSING",
      }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 5, total: 0 });
  });

  it("supports exact asset ID lookup for scanned label codes", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/assets");
      expect(config.params).toEqual({
        page: 1,
        pageSize: 1,
        assetIdExact: "8e626601-b894-4f2e-acac-85104a978eea",
      });
      return {
        data: { items: [], page: 1, pageSize: 1, total: 0 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetsApi.list({
        page: 1,
        pageSize: 1,
        assetIdExact: "8e626601-b894-4f2e-acac-85104a978eea",
      }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 1, total: 0 });
  });

  it("loads the scoped event history for an asset detail page", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/assets/asset-id/history");
      return {
        data: [],
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(assetsApi.history("asset-id")).resolves.toEqual([]);
  });

  it("uses a version-checked commissioning command", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/assets/asset-id/commission");
      expect(config.headers.get("If-Match")).toBe('"2"');
      expect(JSON.parse(config.data as string)).toEqual({
        commissioningDate: "2026-10-29",
      });
      return {
        data: { id: "asset-id", lifecycle: "ACTIVE" },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetsApi.commission("asset-id", 2, "2026-10-29"),
    ).resolves.toEqual({ id: "asset-id", lifecycle: "ACTIVE" });
  });

  it("uses explicit parent-child relationship commands", async () => {
    const adapter: AxiosAdapter = async (config) => {
      if (config.method === "get") {
        expect(config.url).toBe("/assets/parent-id/relationships");
        return {
          data: [],
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      }
      if (config.url === "/assets/parent-id/relationships") {
        expect(JSON.parse(config.data as string)).toEqual({
          childAssetId: "child-id",
        });
        return {
          data: { id: "relationship-id" },
          status: 201,
          statusText: "Created",
          headers: {},
          config,
        };
      }
      expect(config.url).toBe(
        "/assets/parent-id/relationships/relationship-id/end",
      );
      return {
        data: { id: "relationship-id", endedAt: "2026-10-29T12:00:00.000Z" },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(assetsApi.relationships("parent-id")).resolves.toEqual([]);
    await expect(
      assetsApi.addChildRelationship("parent-id", "child-id"),
    ).resolves.toEqual({ id: "relationship-id" });
    await expect(
      assetsApi.endRelationship("parent-id", "relationship-id"),
    ).resolves.toEqual({
      id: "relationship-id",
      endedAt: "2026-10-29T12:00:00.000Z",
    });
  });

  it("uses scoped reservation listing, idempotent creation, and versioned cancellation", async () => {
    const adapter: AxiosAdapter = async (config) => {
      if (config.method === "get") {
        expect(config.url).toBe("/reservations");
        expect(config.params).toEqual({ page: 1, pageSize: 20 });
        return {
          data: { items: [], page: 1, pageSize: 20, total: 0 },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      }
      if (config.url === "/reservations") {
        expect(config.headers.get("Idempotency-Key")).toBe("same-command-key");
        expect(JSON.parse(config.data as string)).toEqual({
          assetId: "asset-id",
          employeeId: "employee-id",
          startDate: "2099-01-01",
          expiresOn: "2099-01-02",
          reason: "New starter equipment",
        });
        return {
          data: { id: "reservation-id" },
          status: 201,
          statusText: "Created",
          headers: {},
          config,
        };
      }
      expect(config.url).toBe("/reservations/reservation-id/cancel");
      expect(config.headers.get("If-Match")).toBe('"3"');
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
      assetsApi.listReservations({ page: 1, pageSize: 20 }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
    await expect(
      assetsApi.createReservation(
        {
          assetId: "asset-id",
          employeeId: "employee-id",
          startDate: "2099-01-01",
          expiresOn: "2099-01-02",
          reason: "New starter equipment",
        },
        "same-command-key",
      ),
    ).resolves.toEqual({ id: "reservation-id" });
    await expect(
      assetsApi.cancelReservation("reservation-id", 3),
    ).resolves.toEqual({ id: "reservation-id", status: "CANCELLED" });
  });

  it("uses idempotent assignment and versioned return commands", async () => {
    const adapter: AxiosAdapter = async (config) => {
      if (config.method === "get") {
        expect(config.url).toBe("/assignments");
        return {
          data: { items: [], page: 1, pageSize: 20, total: 0 },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      }
      if (config.url === "/assignments") {
        expect(config.headers.get("Idempotency-Key")).toBe("assignment-key");
        expect(JSON.parse(config.data as string)).toMatchObject({
          assetId: "asset-id",
          recipientType: "EMPLOYEE",
        });
        return {
          data: { id: "assignment-id" },
          status: 201,
          statusText: "Created",
          headers: {},
          config,
        };
      }
      expect(config.url).toBe("/assignments/assignment-id/return");
      expect(config.headers.get("If-Match")).toBe('"4"');
      expect(config.headers.get("Idempotency-Key")).toBe("return-key");
      return {
        data: { id: "assignment-id", status: "RETURNED" },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetsApi.listAssignments({ page: 1, pageSize: 20 }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
    await expect(
      assetsApi.createAssignment(
        {
          assetId: "asset-id",
          recipientType: "EMPLOYEE",
          employeeId: "employee-id",
          conditionAtIssue: "GOOD",
          purpose: "New starter equipment",
        },
        "assignment-key",
      ),
    ).resolves.toEqual({ id: "assignment-id" });
    await expect(
      assetsApi.returnAssignment("assignment-id", 4, "return-key", {
        conditionAtReturn: "GOOD",
        inspectionRequired: false,
      }),
    ).resolves.toEqual({ id: "assignment-id", status: "RETURNED" });
  });
});
