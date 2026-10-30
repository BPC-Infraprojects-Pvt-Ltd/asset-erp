import { createFileRoute } from "@tanstack/react-router";
import { AssetTransfersPage } from "../features/assets/asset-transfers-page";

export const Route = createFileRoute("/transfers")({
  component: AssetTransfersPage,
});
