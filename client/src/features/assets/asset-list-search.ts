import { z } from "zod";

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
});

export type AssetListSearch = z.infer<typeof assetListSearchSchema>;
