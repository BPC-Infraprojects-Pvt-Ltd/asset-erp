import type { AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { apiClient } from "../../lib/api/client";
import { masterDataApi } from "./master-data-api";

describe("organization master data API", () => {
  const originalAdapter = apiClient.defaults.adapter;

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it("requests a paged, filtered department list", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/master/departments");
      expect(config.params).toEqual({
        page: 2,
        pageSize: 10,
        search: "IT",
        includeInactive: true,
      });
      return {
        data: { items: [], page: 2, pageSize: 10, total: 0 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      masterDataApi.list("department", {
        page: 2,
        pageSize: 10,
        search: "IT",
        includeInactive: true,
      }),
    ).resolves.toEqual({ items: [], page: 2, pageSize: 10, total: 0 });
  });

  it("creates cost centers without numeric coercion", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/master/cost-centers");
      expect(JSON.parse(config.data as string)).toEqual({
        code: "00418",
        name: "IT Operations",
      });
      return {
        data: { id: "cost-center-id", code: "00418", name: "IT Operations" },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      masterDataApi.create("cost-center", {
        code: "00418",
        name: "IT Operations",
      }),
    ).resolves.toMatchObject({ code: "00418" });
  });

  it("loads the latest department version for conflict review", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/master/departments/department-id");
      return {
        data: {
          id: "department-id",
          code: "IT-OPS",
          name: "IT Operations",
          version: 3,
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      masterDataApi.get("department", "department-id"),
    ).resolves.toMatchObject({ version: 3 });
  });

  it("sends a quoted version when updating an organization master", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("put");
      expect(config.url).toBe("/master/departments/department-id");
      expect(config.headers.get("If-Match")).toBe('"5"');
      return {
        data: { id: "department-id", version: 6 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      masterDataApi.update("department", "department-id", 5, {
        code: "IT-OPS",
        name: "IT Operations",
      }),
    ).resolves.toMatchObject({ version: 6 });
  });

  it.each([
    ["deactivate", false],
    ["reactivate", true],
  ] as const)(
    "uses versioned %s lifecycle commands",
    async (action, isActive) => {
      const adapter: AxiosAdapter = async (config) => {
        expect(config.method).toBe("post");
        expect(config.url).toBe(
          `/master/cost-centers/cost-center-id/${action}`,
        );
        expect(config.headers.get("If-Match")).toBe('"2"');
        return {
          data: { id: "cost-center-id", isActive },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };
      apiClient.defaults.adapter = adapter;

      await expect(
        masterDataApi.setActive("cost-center", "cost-center-id", 2, isActive),
      ).resolves.toMatchObject({ isActive });
    },
  );

  it("requests manufacturer-filtered model lookups", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/master/asset-models");
      expect(config.params).toEqual({
        page: 1,
        pageSize: 20,
        manufacturerId: "manufacturer-id",
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
      masterDataApi.listAssetModels({
        page: 1,
        pageSize: 20,
        manufacturerId: "manufacturer-id",
      }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it("updates employees with an optimistic version header", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("put");
      expect(config.url).toBe("/master/employees/employee-id");
      expect(config.headers.get("If-Match")).toBe('"3"');
      expect(JSON.parse(config.data as string)).toEqual({
        employeeNumber: "000184",
        displayName: "Tara Menon",
      });
      return {
        data: { id: "employee-id", version: 4 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      masterDataApi.updateEmployee("employee-id", 3, {
        employeeNumber: "000184",
        displayName: "Tara Menon",
      }),
    ).resolves.toMatchObject({ version: 4 });
  });

  it("loads the latest employee reference for conflict review", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/master/employees/employee-id");
      return {
        data: {
          id: "employee-id",
          employeeNumber: "000184",
          displayName: "Tara Menon",
          version: 4,
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      masterDataApi.getEmployee("employee-id"),
    ).resolves.toMatchObject({ employeeNumber: "000184", version: 4 });
  });

  it("creates a model linked to the selected manufacturer", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/master/asset-models");
      expect(JSON.parse(config.data as string)).toEqual({
        manufacturerId: "manufacturer-id",
        name: "ThinkPad T14",
      });
      return {
        data: {
          id: "model-id",
          manufacturerId: "manufacturer-id",
          name: "ThinkPad T14",
        },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      masterDataApi.createAssetModel({
        manufacturerId: "manufacturer-id",
        name: "ThinkPad T14",
      }),
    ).resolves.toMatchObject({ manufacturerId: "manufacturer-id" });
  });

  it("requests only the paged employee reference fields", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/master/employees");
      expect(config.params).toEqual({ page: 1, pageSize: 20 });
      return {
        data: {
          items: [
            {
              id: "employee-id",
              employeeNumber: "000184",
              displayName: "Tara Menon",
              isActive: true,
              version: 1,
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      masterDataApi.listEmployees({ page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({
      items: [{ employeeNumber: "000184", displayName: "Tara Menon" }],
    });
  });
});
