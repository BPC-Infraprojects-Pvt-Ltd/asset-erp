import { isAxiosError } from "axios";
import { authErrorMessage } from "../auth/auth-errors";

export interface AssetCategoryEditError {
  conflict: boolean;
  requiresReview: boolean;
  message: string;
}

export function assetCategoryEditError(error: unknown): AssetCategoryEditError {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const conflict = status === 409;
  const requiresReview =
    isAxiosError(error) && (status === undefined || status >= 500);

  return {
    conflict,
    requiresReview,
    message: conflict
      ? "This category changed on the server. Your draft is kept. Load the latest category to review it before deciding whether to discard your draft. Nothing has been resubmitted."
      : requiresReview
        ? "The save outcome is unknown. Your draft is kept. Load the latest category to review its server state before retrying."
        : authErrorMessage(error),
  };
}
