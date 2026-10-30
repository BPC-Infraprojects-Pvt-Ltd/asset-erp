import { createFileRoute } from "@tanstack/react-router";
import { AccessoriesStockPage } from "../features/stock/stock-page";

export const Route = createFileRoute("/stock")({
  component: AccessoriesStockPage,
});
