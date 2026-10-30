import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { RetirementRequestsPage } from "../features/assets/retirement-requests-page";

export const Route = createFileRoute("/retirements")({
  validateSearch: z.object({
    assetId: z.string().uuid().optional().catch(undefined),
  }),
  component: RetirementRequestsPage,
});
