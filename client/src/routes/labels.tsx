import { createFileRoute } from "@tanstack/react-router";
import { AssetLabelsPage } from "../features/assets/asset-labels-page";

export const Route = createFileRoute("/labels")({
  component: AssetLabelsPage,
});
