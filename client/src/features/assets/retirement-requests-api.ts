import { apiClient } from "../../lib/api/client";
import type { AssetAvailability, AssetLifecycle } from "./assets-api";

export interface RetirementRequest {
  id: string;
  organizationId: string;
  assetId: string;
  requestedByUserId: string;
  reason: string;
  impactReview: string;
  status: "PENDING_REVIEW";
  version: number;
  createdAt: string;
  updatedAt: string;
  asset: {
    id: string;
    assetTag: string;
    lifecycle: AssetLifecycle;
    availability: AssetAvailability;
    location: { id: string; code: string; name: string };
    category: { code: string; name: string };
  };
  requestedBy: { id: string; displayName: string };
}

export interface PagedRetirementRequests {
  items: RetirementRequest[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RetirementRequestQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface CreateRetirementRequestInput {
  reason: string;
  impactReview: string;
}

export const retirementRequestsApi = {
  async list(query: RetirementRequestQuery): Promise<PagedRetirementRequests> {
    const { data } = await apiClient.get<PagedRetirementRequests>(
      "/retirements/requests",
      { params: query },
    );
    return data;
  },

  async create(
    assetId: string,
    input: CreateRetirementRequestInput,
    idempotencyKey: string,
  ): Promise<RetirementRequest> {
    const { data } = await apiClient.post<RetirementRequest>(
      `/retirements/assets/${assetId}/requests`,
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },
};
