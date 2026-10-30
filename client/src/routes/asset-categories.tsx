import { createFileRoute } from "@tanstack/react-router";
import { AssetCategoriesPage } from "../features/assets/asset-categories-page";

export const Route = createFileRoute("/asset-categories")({
  component: AssetCategoriesPage,
});
