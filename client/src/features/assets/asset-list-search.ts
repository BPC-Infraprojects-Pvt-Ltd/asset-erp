import { z } from "zod";

const dateOnlySearch = z
  .string()
  .refine((value) => {
    if (!value) return true;
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  })
  .catch("");

export const assetListSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().catch(""),
  locationId: z.string().uuid().catch(""),
  categoryId: z.string().uuid().catch(""),
  lifecycle: z
    .enum(["", "RECEIVED", "ACTIVE", "RETIRED", "DISPOSED"])
    .catch(""),
  availability: z
    .enum([
      "",
      "AVAILABLE",
      "RESERVED",
      "ASSIGNED",
      "IN_TRANSIT",
      "IN_REPAIR",
      "QUARANTINED",
      "UNAVAILABLE",
    ])
    .catch(""),
  condition: z
    .enum(["", "NEW", "GOOD", "FAIR", "DAMAGED", "NONFUNCTIONAL", "UNKNOWN"])
    .catch(""),
  verification: z
    .enum(["", "VERIFIED", "MISSING", "DISPUTED", "NOT_CHECKED"])
    .catch(""),
  warrantyExpiresOnFrom: dateOnlySearch,
  warrantyExpiresOnTo: dateOnlySearch,
});

export type AssetListSearch = z.infer<typeof assetListSearchSchema>;

export function assetIdFromScannedCode(value: string): string | undefined {
  const normalized = value.trim();
  const compact = normalized.replaceAll("-", "").toLowerCase();
  if (!/^[\da-f]{32}$/i.test(compact)) return undefined;
  if (
    normalized.includes("-") &&
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      normalized,
    )
  ) {
    return undefined;
  }
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}
