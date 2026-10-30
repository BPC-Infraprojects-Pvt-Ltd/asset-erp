import type { UserRole } from "../../lib/api/auth-contract";

export function canViewAssetRegister(role: UserRole | undefined): boolean {
  return role === "ADMINISTRATOR" || role === "ASSET_MANAGER";
}

export function canManageAssetRegister(role: UserRole | undefined): boolean {
  return role === "ASSET_MANAGER";
}

export function canManageAssetCategories(role: UserRole | undefined): boolean {
  return role === "ADMINISTRATOR";
}
