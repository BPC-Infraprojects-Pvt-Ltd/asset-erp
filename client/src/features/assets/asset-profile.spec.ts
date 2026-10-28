import { AxiosError, type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { apiClient } from "../../lib/api/client";
import { assetsApi, type Asset } from "./assets-api";
import {
  assetProfileError,
  assetProfileSchema,
  assetProfileValues,
} from "./asset-profile";

const profile = {
  manufacturer: "Manufacturer",
  model: "",
  serialNumber: "000123",
  sourceReference: "",
  notes: "",
};

describe("asset descriptive profile", () => {
  const originalAdapter = apiClient.defaults.adapter;
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it("uses the profile-only route, complete payload and quoted If-Match version", async () => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.method).toBe("put");
      expect(config.url).toBe("/assets/asset-a/profile");
      expect(config.headers.get("If-Match")).toBe('"3"');
      expect(JSON.parse(config.data as string)).toEqual(profile);
      return {
        data: { id: "asset-a", version: 4 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    apiClient.defaults.adapter = adapter;
    await expect(
      assetsApi.updateProfile("asset-a", 3, profile),
    ).resolves.toEqual({ id: "asset-a", version: 4 });
  });

  it("normalizes whitespace without losing leading zeros and allows clearing values", () => {
    expect(
      assetProfileSchema.parse({ ...profile, serialNumber: " 000123 " }),
    ).toEqual(profile);
    expect(
      assetProfileValues({
        ...profile,
        manufacturer: null,
        notes: null,
      } as Asset),
    ).toEqual({ ...profile, manufacturer: "", notes: "" });
  });

  it("rejects workflow fields, missing values, nulls and overlong values", () => {
    for (const input of [
      { ...profile, locationId: "location-b" },
      { ...profile, lifecycle: "DISPOSED" },
      { ...profile, notes: null },
      { ...profile, manufacturer: "x".repeat(151) },
      { ...profile, notes: "x".repeat(2001) },
      {},
    ])
      expect(assetProfileSchema.safeParse(input).success).toBe(false);
  });

  it("makes conflicts actionable even without a problem body", () => {
    const error = new AxiosError("Conflict");
    error.response = { status: 409 } as AxiosError["response"];
    expect(assetProfileError(error)).toEqual({
      conflict: true,
      requiresReview: false,
      message: expect.stringMatching(
        /draft is kept.*review.*explicitly discard.*Nothing has been resubmitted/,
      ),
    });
  });

  it.each([
    ["network failure", new AxiosError("Network error")],
    [
      "server error",
      Object.assign(new AxiosError("Server error"), {
        response: { status: 500 } as AxiosError["response"],
      }),
    ],
  ])(
    "requires checking server state before retrying an unknown %s",
    (_kind, error) => {
      expect(assetProfileError(error)).toEqual({
        conflict: false,
        requiresReview: true,
        message: expect.stringMatching(
          /outcome is unknown.*draft is kept.*before retrying/,
        ),
      });
    },
  );

  it("uses shared safe error handling for non-conflict failures", () => {
    const error = new AxiosError("Validation failed");
    error.response = {
      status: 400,
      data: { detail: "Invalid profile" },
    } as AxiosError["response"];
    expect(assetProfileError(error)).toEqual({
      conflict: false,
      requiresReview: false,
      message: "Invalid profile",
    });
    expect(assetProfileError(new Error("network"))).toEqual({
      conflict: false,
      requiresReview: false,
      message: expect.any(String),
    });
  });
});
