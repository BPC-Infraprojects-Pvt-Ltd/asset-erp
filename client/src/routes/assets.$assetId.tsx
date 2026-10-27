import { createFileRoute } from "@tanstack/react-router";
import { AssetDetailPage } from "../features/assets/asset-detail-page";

export const Route = createFileRoute("/assets/$assetId")({
  component: AssetDetailPage,
});
