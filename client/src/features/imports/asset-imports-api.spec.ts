import type { AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { apiClient } from "../../lib/api/client";
import { assetImportsApi } from "./asset-imports-api";

describe("asset imports API", () => {
  const originalAdapter = apiClient.defaults.adapter;
  const file = new File(["assetTag,categoryCode"], "assets.csv", {
    type: "text/csv",
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it("uploads a CSV for preview without storing it in client state", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/imports/assets/preview");
      expect(config.headers.get("Idempotency-Key")).toBe("preview-key");
      expect(config.data).toBeInstanceOf(FormData);
      expect((config.data as FormData).get("file")).toBeInstanceOf(Blob);
      return {
        data: {
          job: { id: "job-id", status: "PREVIEW_READY" },
          errors: [],
          sampleRows: [],
        },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetImportsApi.preview(file, "preview-key"),
    ).resolves.toMatchObject({
      job: { id: "job-id", status: "PREVIEW_READY" },
    });
  });

  it("re-uploads the original CSV with If-Match and commit idempotency headers", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/imports/job-id/commit");
      expect(config.headers.get("If-Match")).toBe('"2"');
      expect(config.headers.get("Idempotency-Key")).toBe("commit-key");
      expect((config.data as FormData).get("file")).toBeInstanceOf(Blob);
      return {
        data: { job: { id: "job-id", status: "COMMITTED" }, errors: [] },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      assetImportsApi.commit("job-id", 2, file, "commit-key"),
    ).resolves.toMatchObject({
      job: { id: "job-id", status: "COMMITTED" },
    });
  });
});
