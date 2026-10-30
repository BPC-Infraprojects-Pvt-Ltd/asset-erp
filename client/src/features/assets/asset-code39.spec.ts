import { describe, expect, it } from "vitest";
import { encodeAssetIdCode39 } from "./asset-code39";

describe("asset Code 39 labels", () => {
  it("encodes the internal asset UUID with start/stop markers and quiet zones", () => {
    const barcode = encodeAssetIdCode39("8e626601-b894-4f2e-acac-85104a978eea");

    expect(barcode.bars).toHaveLength(34 * 5);
    expect(barcode.width).toBe(34 * 15 + 33 + 20);
    expect(barcode.bars[0]).toEqual({ x: 10, width: 1 });
    expect(barcode.bars.at(-1)?.x).toBeLessThan(barcode.width - 10);
  });

  it("rejects values that are not UUIDs", () => {
    expect(() => encodeAssetIdCode39("asset-tag")).toThrow(
      "Asset ID must be a UUID.",
    );
    expect(() =>
      encodeAssetIdCode39("8e626601-b894-4f2e-acac-85104a978eez"),
    ).toThrow("Asset ID must be a UUID.");
  });
});
