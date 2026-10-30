import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AssetVerificationPage } from "../features/assets/asset-verification-page";

export const Route = createFileRoute("/verification-campaigns")({
  validateSearch: z.object({
    campaignId: z.string().uuid().optional().catch(undefined),
  }),
  component: AssetVerificationPage,
});
