import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AssetImportsPage } from "../features/imports/asset-imports-page";

export const Route = createFileRoute("/imports")({
  validateSearch: z.object({
    jobId: z.string().uuid().optional(),
  }),
  component: AssetImportsPage,
});
