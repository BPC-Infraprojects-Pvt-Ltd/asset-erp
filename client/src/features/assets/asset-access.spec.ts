import { describe, expect, it } from "vitest";
import {
  canManageAssetRegister,
  canManageAssetCategories,
  canViewAssetRegister,
} from "./asset-access";

describe("hardware page access", () => {
  it("allows Administrators and Asset Managers to view the asset register", () => {
    expect(canViewAssetRegister("ADMINISTRATOR")).toBe(true);
    expect(canViewAssetRegister("ASSET_MANAGER")).toBe(true);
    expect(canViewAssetRegister("EMPLOYEE")).toBe(false);
    expect(canViewAssetRegister(undefined)).toBe(false);
  });

  it("reserves asset registration and editing for Asset Managers", () => {
    expect(canManageAssetRegister("ASSET_MANAGER")).toBe(true);
    expect(canManageAssetRegister("ADMINISTRATOR")).toBe(false);
    expect(canManageAssetRegister("EMPLOYEE")).toBe(false);
    expect(canManageAssetRegister(undefined)).toBe(false);
  });

  it("limits asset category administration to Administrators", () => {
    expect(canManageAssetCategories("ADMINISTRATOR")).toBe(true);
    expect(canManageAssetCategories("ASSET_MANAGER")).toBe(false);
    expect(canManageAssetCategories("EMPLOYEE")).toBe(false);
    expect(canManageAssetCategories(undefined)).toBe(false);
  });
});
