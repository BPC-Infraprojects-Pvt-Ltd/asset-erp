import { createFileRoute } from "@tanstack/react-router";
import { AssetReservationsPage } from "../features/assets/asset-reservations-page";

export const Route = createFileRoute("/reservations")({
  component: AssetReservationsPage,
});
