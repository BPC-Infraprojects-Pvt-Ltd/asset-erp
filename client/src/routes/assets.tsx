import { createFileRoute } from "@tanstack/react-router";
import { AssetsPage } from "../features/assets/assets-page";
import { assetListSearchSchema } from "../features/assets/asset-list-search";

export const Route = createFileRoute("/assets")({
  validateSearch: assetListSearchSchema,
  component: AssetsPage,
});
