import { createFileRoute } from "@tanstack/react-router";
import { ModuleRoutePage } from "../features/modules/module-page";
import { z } from "zod";

export const Route = createFileRoute("/modules/$moduleId")({
  validateSearch: z.object({
    demo: z.boolean().optional(),
    record: z.string().optional(),
    form: z.boolean().optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().optional(),
    includeInactive: z.preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }, z.boolean().optional()),
  }),
  component: ModuleRoutePage,
});
