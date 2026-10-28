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
});
