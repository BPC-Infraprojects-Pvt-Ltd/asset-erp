import { type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { apiClient } from "../../lib/api/client";
import { retirementRequestsApi } from "./retirement-requests-api";

describe("retirement request API", () => {
  const originalAdapter = apiClient.defaults.adapter;
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it("submits a pending request with server idempotency identity", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/retirements/assets/asset-id/requests");
      expect(config.headers.get("Idempotency-Key")).toBe("request-key");
      expect(JSON.parse(config.data as string)).toEqual({
        reason: "End of support",
        impactReview: "Recover assigned accessories",
      });
      return {
        data: { id: "request-id", status: "PENDING_REVIEW" },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;

    await expect(
      retirementRequestsApi.create(
        "asset-id",
        {
          reason: "End of support",
          impactReview: "Recover assigned accessories",
        },
        "request-key",
      ),
    ).resolves.toMatchObject({ id: "request-id", status: "PENDING_REVIEW" });
  });
});
