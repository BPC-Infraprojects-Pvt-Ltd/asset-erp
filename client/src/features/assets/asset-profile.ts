import { isAxiosError } from "axios";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import type { Asset, UpdateAssetProfileInput } from "./assets-api";

export const profileFields = [
  { name: "manufacturer", label: "Manufacturer", maxLength: 150 },
  { name: "model", label: "Model", maxLength: 150 },
  { name: "serialNumber", label: "Serial number", maxLength: 150 },
  { name: "sourceReference", label: "Source reference", maxLength: 150 },
  { name: "purchaseDate", label: "Purchase date", maxLength: 10, type: "date" },
  {
    name: "warrantyExpiresOn",
    label: "Warranty expiry date",
    maxLength: 10,
    type: "date",
  },
  { name: "warrantyReference", label: "Warranty reference", maxLength: 150 },
  { name: "notes", label: "Notes", maxLength: 2000 },
] as const;

const dateOnly = z.string().refine((value) => {
  if (!value) return true;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}, "Enter a valid calendar date.");

export const assetProfileSchema = z.strictObject({
  manufacturer: z.string().trim().max(150),
  model: z.string().trim().max(150),
  serialNumber: z.string().trim().max(150),
  sourceReference: z.string().trim().max(150),
  criticality: z.enum(["", "LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  purchaseDate: dateOnly,
  warrantyExpiresOn: dateOnly,
  warrantyReference: z.string().trim().max(150),
  notes: z.string().trim().max(2000),
  specifications: z.record(z.string(), z.string()),
});

export function assetProfileValues(asset: Asset): UpdateAssetProfileInput {
  return {
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
    serialNumber: asset.serialNumber ?? "",
    sourceReference: asset.sourceReference ?? "",
    criticality: asset.criticality ?? "",
    purchaseDate: asset.purchaseDate?.slice(0, 10) ?? "",
    warrantyExpiresOn: asset.warrantyExpiresOn?.slice(0, 10) ?? "",
    warrantyReference: asset.warrantyReference ?? "",
    notes: asset.notes ?? "",
    specifications: asset.specifications ?? {},
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
