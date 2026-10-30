import { AxiosError, type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { apiClient } from "../../lib/api/client";
import { verificationApi } from "./verification-api";

describe("verification API", () => {
  const originalAdapter = apiClient.defaults.adapter;
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it("binds campaign creation to a server idempotency key", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/verification/campaigns");
      expect(config.headers.get("Idempotency-Key")).toBe("campaign-key");
      expect(JSON.parse(config.data as string)).toEqual({
        locationId: "location-id",
        name: "Quarterly check",
      });
      return {
        data: { id: "campaign-id" },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      verificationApi.createCampaign(
        { locationId: "location-id", name: "Quarterly check" },
        "campaign-key",
      ),
    ).resolves.toEqual({ id: "campaign-id" });
  });

  it("uses the observation version and retry key when reconciling", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.url).toBe(
        "/verification/campaigns/campaign-id/observations/observation-id/reconcile",
      );
      expect(config.headers.get("If-Match")).toBe('"4"');
      expect(config.headers.get("Idempotency-Key")).toBe("review-key");
      expect(JSON.parse(config.data as string)).toEqual({ applyFinding: true });
      return {
        data: { id: "observation-id", version: 5 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      verificationApi.reconcileObservation(
        "campaign-id",
        "observation-id",
        4,
        { applyFinding: true },
        "review-key",
      ),
    ).resolves.toEqual({ id: "observation-id", version: 5 });
  });

  it("preserves explicit server errors rather than simulating a saved observation", async () => {
    const adapter: AxiosAdapter = async () => {
      throw new AxiosError("server rejected finding");
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      verificationApi.recordUnexpectedObservation(
        "campaign-id",
        { found: true, observedTag: "UNEXPECTED-01" },
        "observation-key",
      ),
    ).rejects.toThrow("server rejected finding");
  });
});
