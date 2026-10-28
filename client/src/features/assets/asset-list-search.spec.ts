import { describe, expect, it } from "vitest";
import { assetListSearchSchema } from "./asset-list-search";

describe("asset list route search", () => {
  it("normalizes invalid parameters without rejecting the route", () => {
    expect(
      assetListSearchSchema.parse({
        page: "not-a-page",
        locationId: "not-a-uuid",
        categoryId: "also-not-a-uuid",
        lifecycle: "UNKNOWN_STATE",
        availability: "UNKNOWN_STATE",
        condition: "UNKNOWN_STATE",
        verification: "UNKNOWN_STATE",
      }),
    ).toEqual({
      page: 1,
      search: "",
      locationId: "",
      categoryId: "",
      lifecycle: "",
      availability: "",
      condition: "",
      verification: "",
    });
  });

  it("retains supported search, filter, and one-based page parameters", () => {
    expect(
      assetListSearchSchema.parse({
        page: "3",
        search: "laptop 001",
        locationId: "40e9ce48-e66d-4bfc-a4ea-df85269a96c3",
        categoryId: "9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2",
        lifecycle: "ACTIVE",
        availability: "ASSIGNED",
        condition: "GOOD",
        verification: "MISSING",
      }),
    ).toEqual({
      page: 3,
      search: "laptop 001",
      locationId: "40e9ce48-e66d-4bfc-a4ea-df85269a96c3",
      categoryId: "9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2",
      lifecycle: "ACTIVE",
      availability: "ASSIGNED",
      condition: "GOOD",
      verification: "MISSING",
    });
  });
});
