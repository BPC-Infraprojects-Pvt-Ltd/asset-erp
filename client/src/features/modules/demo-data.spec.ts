import { describe, expect, it } from "vitest";
import { demoDataById } from "./demo-data";
import { demoDetailProfilesById } from "./demo-detail-profiles";
import { demoFormProfilesById } from "./demo-form-profiles";
import { modulePagesById } from "./module-pages";

describe("demo page data", () => {
  it("provides an isolated dataset for every module page", () => {
    expect(Object.keys(demoDataById).sort()).toEqual(
      [...modulePagesById.keys()].sort(),
    );
  });

  it("keeps every example row aligned with its table columns", () => {
    const mismatches: string[] = [];

    for (const [pageId, data] of Object.entries(demoDataById)) {
      expect(data.metrics, pageId).toHaveLength(3);
      expect(data.rows.length, pageId).toBeGreaterThan(0);

      for (const row of data.rows) {
        if (row.cells.length !== data.columns.length) {
          mismatches.push(
            `${pageId} ${row.reference}: expected ${data.columns.length}, got ${row.cells.length}`,
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("uses unique record references within each feature", () => {
    for (const [pageId, data] of Object.entries(demoDataById)) {
      const references = data.rows.map((row) => row.reference);
      expect(new Set(references).size, pageId).toBe(references.length);
    }
  });

  it("defines feature-specific detail views for every module", () => {
    expect(Object.keys(demoDetailProfilesById).sort()).toEqual(
      Object.keys(demoDataById).sort(),
    );

    const detailTabs = Object.values(demoDetailProfilesById).map(
      (profile) => profile.detailTab,
    );
    expect(new Set(detailTabs).size).toBe(detailTabs.length);
    const detailLayouts = new Set(
      Object.values(demoDetailProfilesById).map((profile) => profile.layout),
    );
    expect(detailLayouts.size).toBe(10);

    for (const [pageId, profile] of Object.entries(demoDetailProfilesById)) {
      const { columns } = demoDataById[pageId as keyof typeof demoDataById];
      for (const index of [
        ...profile.overviewColumns,
        ...profile.detailColumns,
        ...profile.relatedColumns,
        ...(profile.ownerColumn === null ? [] : [profile.ownerColumn]),
      ]) {
        expect(index, pageId).toBeGreaterThanOrEqual(0);
        expect(index, pageId).toBeLessThan(columns.length);
      }
    }
  });

  it("defines unique, usable form previews for every module", () => {
    expect(Object.keys(demoFormProfilesById).sort()).toEqual(
      Object.keys(demoDataById).sort(),
    );

    for (const [pageId, profile] of Object.entries(demoFormProfilesById)) {
      expect(profile.fields.length, pageId).toBeGreaterThan(0);
      expect(
        new Set(profile.fields.map((field) => field.id)).size,
        pageId,
      ).toBe(profile.fields.length);

      for (const field of profile.fields) {
        if (field.kind === "select") {
          expect(
            field.options?.length,
            `${pageId}: ${field.id}`,
          ).toBeGreaterThan(0);
        }
        if (field.kind === "file") {
          expect(field.disabled, `${pageId}: ${field.id}`).toBe(true);
        }
      }
    }
  });
});
