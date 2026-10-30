import type { AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { apiClient } from "../../lib/api/client";
import { assetsApi } from "./assets-api";

describe("component installation API", () => {
  const originalAdapter = apiClient.defaults.adapter;

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it("loads scoped component installation history", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("get");
      expect(config.url).toBe("/assets/host-id/components");
      return {
        data: [],
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(assetsApi.componentInstallations("host-id")).resolves.toEqual(
      [],
    );
  });

  it("installs a component with an idempotency key", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/assets/host-id/components/install");
      expect(config.headers.get("Idempotency-Key")).toBe("install-key");
      const body =
        typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      expect(body).toEqual({
        componentAssetId: "component-id",
        installNote: "Installed during repair",
      });
      return {
        data: { id: "installation-id", version: 1 },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetsApi.installComponent(
        "host-id",
        {
          componentAssetId: "component-id",
          installNote: "Installed during repair",
        },
        "install-key",
      ),
    ).resolves.toMatchObject({ id: "installation-id", version: 1 });
  });

  it("removes a component with a version and retry contract", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe(
        "/assets/host-id/components/installation-id/remove",
      );
      expect(config.headers.get("If-Match")).toBe('"1"');
      expect(config.headers.get("Idempotency-Key")).toBe("remove-key");
      return {
        data: { id: "installation-id", version: 2, removedAt: "now" },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetsApi.removeComponent("host-id", "installation-id", 1, "remove-key", {
        removalNote: "Replaced component",
      }),
    ).resolves.toMatchObject({ id: "installation-id", version: 2 });
  });
});
