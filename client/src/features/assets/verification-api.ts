import { apiClient } from "../../lib/api/client";
import type { AssetCondition, AssetLifecycle } from "./assets-api";

export type VerificationCampaignStatus = "OPEN" | "COMPLETED";
export type VerificationObservationResult =
  | "VERIFIED"
  | "MISSING"
  | "MISPLACED"
  | "TAG_MISMATCH"
  | "DAMAGED"
  | "DISPUTED"
  | "UNEXPECTED"
  | "DUPLICATE";
export type VerificationObservationResolution =
  "PENDING" | "RECONCILED" | "DISMISSED";

export interface VerificationCampaign {
  id: string;
  organizationId: string;
  locationId: string;
  name: string;
  status: VerificationCampaignStatus;
  version: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedByUserId: string | null;
  location: { id: string; code: string; name: string };
  _count: { expectedAssets: number; observations: number };
}

export interface VerificationObservation {
  id: string;
  organizationId: string;
  campaignId: string;
  expectedAssetId: string | null;
  observedAssetId: string | null;
  observedTag: string | null;
  observedLocationId: string | null;
  observedCustodianId: string | null;
  observedCondition: AssetCondition | null;
  result: VerificationObservationResult;
  notes: string | null;
  observedAt: string;
  observedByUserId: string;
  resolution: VerificationObservationResolution;
  version: number;
  reconciledByUserId: string | null;
  reconciledAt: string | null;
  resolutionNote: string | null;
  expectedAsset: {
    id: string;
    expectedAssetTag: string;
    expectedLocationCode: string;
    expectedLocationName: string;
    expectedCategoryCode: string;
    expectedCategoryName: string;
    expectedLifecycle: AssetLifecycle;
    expectedCondition: AssetCondition;
  } | null;
  observedCustodian: {
    id: string;
    employeeNumber: string;
    displayName: string;
  } | null;
  observedBy: { id: string; displayName: string };
  reconciledBy: { id: string; displayName: string } | null;
}

export interface VerificationCampaignAsset {
  id: string;
  campaignId: string;
  assetId: string;
  expectedAssetTag: string;
  expectedLocationId: string;
  expectedLocationCode: string;
  expectedLocationName: string;
  expectedCategoryCode: string;
  expectedCategoryName: string;
  expectedLifecycle: AssetLifecycle;
  expectedCondition: AssetCondition;
  expectedAssetVersion: number;
  createdAt: string;
  observations: VerificationObservation[];
}

export interface PagedVerification<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface VerificationListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface CreateVerificationCampaignInput {
  locationId: string;
  name: string;
}

export interface CreateVerificationObservationInput {
  found: boolean;
  observedTag?: string;
  observedLocationId?: string;
  observedCustodianId?: string;
  observedCustodianNumber?: string;
  observedCondition?: AssetCondition;
  notes?: string;
}

export interface ReconcileVerificationObservationInput {
  applyFinding: boolean;
  note?: string;
}

const campaignPath = "/verification/campaigns";

export const verificationApi = {
  async listCampaigns(
    query: VerificationListQuery,
  ): Promise<PagedVerification<VerificationCampaign>> {
    const { data } = await apiClient.get<
      PagedVerification<VerificationCampaign>
    >(campaignPath, { params: query });
    return data;
  },

  async createCampaign(
    input: CreateVerificationCampaignInput,
    idempotencyKey: string,
  ): Promise<VerificationCampaign> {
    const { data } = await apiClient.post<VerificationCampaign>(
      campaignPath,
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  async getCampaign(id: string): Promise<VerificationCampaign> {
    const { data } = await apiClient.get<VerificationCampaign>(
      `${campaignPath}/${id}`,
    );
    return data;
  },

  async listAssets(
    campaignId: string,
    query: VerificationListQuery,
  ): Promise<PagedVerification<VerificationCampaignAsset>> {
    const { data } = await apiClient.get<
      PagedVerification<VerificationCampaignAsset>
    >(`${campaignPath}/${campaignId}/assets`, { params: query });
    return data;
  },

  async listObservations(
    campaignId: string,
    query: VerificationListQuery,
  ): Promise<PagedVerification<VerificationObservation>> {
    const { data } = await apiClient.get<
      PagedVerification<VerificationObservation>
    >(`${campaignPath}/${campaignId}/observations`, { params: query });
    return data;
  },

  async recordExpectedObservation(
    campaignId: string,
    expectedAssetId: string,
    input: CreateVerificationObservationInput,
    idempotencyKey: string,
  ): Promise<VerificationObservation> {
    const { data } = await apiClient.post<VerificationObservation>(
      `${campaignPath}/${campaignId}/assets/${expectedAssetId}/observations`,
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  async recordUnexpectedObservation(
    campaignId: string,
    input: CreateVerificationObservationInput,
    idempotencyKey: string,
  ): Promise<VerificationObservation> {
    const { data } = await apiClient.post<VerificationObservation>(
      `${campaignPath}/${campaignId}/unexpected-observations`,
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  async reconcileObservation(
    campaignId: string,
    observationId: string,
    version: number,
    input: ReconcileVerificationObservationInput,
    idempotencyKey: string,
  ): Promise<VerificationObservation> {
    const { data } = await apiClient.post<VerificationObservation>(
      `${campaignPath}/${campaignId}/observations/${observationId}/reconcile`,
      input,
      {
        headers: {
          "If-Match": `"${version}"`,
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
    return data;
  },

  async completeCampaign(
    campaignId: string,
    version: number,
    idempotencyKey: string,
  ): Promise<VerificationCampaign> {
    const { data } = await apiClient.post<VerificationCampaign>(
      `${campaignPath}/${campaignId}/complete`,
      undefined,
      {
        headers: {
          "If-Match": `"${version}"`,
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
    return data;
  },
};
