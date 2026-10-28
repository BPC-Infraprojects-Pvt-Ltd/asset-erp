import { describe, expect, it } from "vitest";
import { formatAssetStatus, formatAssetTimestamp } from "./asset-detail-format";

describe("asset detail formatting", () => {
  it("formats server timestamps in UTC", () => {
    expect(formatAssetTimestamp("2026-10-28T06:30:00.000Z")).toBe(
      "28 Oct 2026, 06:30 UTC",
    );
  });

  it("reports invalid timestamps instead of displaying an invalid date", () => {
    expect(formatAssetTimestamp("not-a-date")).toBe("Unavailable");
  });

  it("formats underscored state values for display", () => {
    expect(formatAssetStatus("IN_TRANSIT")).toBe("In Transit");
    expect(formatAssetStatus("NONFUNCTIONAL")).toBe("Nonfunctional");
  });
});
