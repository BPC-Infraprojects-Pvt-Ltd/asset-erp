import { isAxiosError } from "axios";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import type { Asset, UpdateAssetProfileInput } from "./assets-api";

export const profileFields = [
  { name: "manufacturer", label: "Manufacturer", maxLength: 150 },
  { name: "model", label: "Model", maxLength: 150 },
  { name: "serialNumber", label: "Serial number", maxLength: 150 },
  { name: "sourceReference", label: "Source reference", maxLength: 150 },
  { name: "notes", label: "Notes", maxLength: 2000 },
] as const;

export const assetProfileSchema = z.strictObject({
  manufacturer: z.string().trim().max(150),
  model: z.string().trim().max(150),
  serialNumber: z.string().trim().max(150),
  sourceReference: z.string().trim().max(150),
  notes: z.string().trim().max(2000),
});

export function assetProfileValues(asset: Asset): UpdateAssetProfileInput {
  return {
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
    serialNumber: asset.serialNumber ?? "",
    sourceReference: asset.sourceReference ?? "",
    notes: asset.notes ?? "",
  };
}

export function assetProfileError(error: unknown) {
  const conflict = isAxiosError(error) && error.response?.status === 409;
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const requiresReview =
    isAxiosError(error) && (status === undefined || status >= 500);
  return {
    conflict,
    requiresReview,
    message: conflict
      ? "This asset changed on the server. Your draft is kept. Load the latest profile to review it, then explicitly discard your draft to edit the latest version. Nothing has been resubmitted."
      : requiresReview
        ? "The save outcome is unknown. Your draft is kept. Load the latest profile to check whether the changes committed before retrying."
        : authErrorMessage(error),
  };
}
