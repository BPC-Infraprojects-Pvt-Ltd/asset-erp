import { createFileRoute } from "@tanstack/react-router";
import { AssetAssignmentsPage } from "../features/assets/asset-assignments-page";

export const Route = createFileRoute("/assignments")({
  component: AssetAssignmentsPage,
});
