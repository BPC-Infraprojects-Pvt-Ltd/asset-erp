import { apiClient } from "../../lib/api/client";

export type AssetLifecycle = "RECEIVED" | "ACTIVE" | "RETIRED" | "DISPOSED";
export type AssetAvailability =
  | "AVAILABLE"
  | "RESERVED"
  | "ASSIGNED"
  | "IN_TRANSIT"
  | "IN_REPAIR"
  | "QUARANTINED"
  | "UNAVAILABLE";
export type AssetCondition =
  "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "NONFUNCTIONAL" | "UNKNOWN";
export type AssetVerification =
  "VERIFIED" | "MISSING" | "DISPUTED" | "NOT_CHECKED";

export interface AssetCategory {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PagedAssetCategories {
  items: AssetCategory[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AssetCategoryListQuery {
  page: number;
  pageSize: number;
  search?: string;
  includeInactive?: boolean;
}

export interface Asset {
  id: string;
  organizationId: string;
  assetTag: string;
  categoryId: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  locationId: string;
  lifecycle: AssetLifecycle;
  availability: AssetAvailability;
  condition: AssetCondition;
  verification: AssetVerification;
  sourceReference: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; code: string; name: string };
  location: { id: string; code: string; name: string };
}

export interface CreateAssetCategoryInput {
  code: string;
  name: string;
}

export interface CreateAssetInput {
  assetTag: string;
  categoryId: string;
  locationId: string;
  availability: Extract<
    AssetAvailability,
    "AVAILABLE" | "QUARANTINED" | "UNAVAILABLE"
  >;
  condition: AssetCondition;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  sourceReference?: string;
  notes?: string;
}

export interface AssetListQuery {
  page: number;
  pageSize: number;
  search?: string;
  locationId?: string;
  categoryId?: string;
  lifecycle?: AssetLifecycle;
  availability?: AssetAvailability;
  condition?: AssetCondition;
  verification?: AssetVerification;
  serialNumberExact?: string;
}

export interface UpdateAssetProfileInput {
  manufacturer: string;
  model: string;
  serialNumber: string;
  sourceReference: string;
  notes: string;
}

export interface PagedAssets {
  items: Asset[];
  page: number;
  pageSize: number;
  total: number;
}

export const assetsApi = {
  async listCategories(
    query: AssetCategoryListQuery,
  ): Promise<PagedAssetCategories> {
    const { data } = await apiClient.get<PagedAssetCategories>(
      "/assets/categories",
      { params: query },
    );
    return data;
  },

  async createCategory(
    input: CreateAssetCategoryInput,
  ): Promise<AssetCategory> {
    const { data } = await apiClient.post<AssetCategory>(
      "/assets/categories",
      input,
    );
    return data;
  },

  async getCategory(categoryId: string): Promise<AssetCategory> {
    const { data } = await apiClient.get<AssetCategory>(
      `/assets/categories/${categoryId}`,
    );
    return data;
  },

  async updateCategory(
    categoryId: string,
    version: number,
    input: CreateAssetCategoryInput,
  ): Promise<AssetCategory> {
    const { data } = await apiClient.put<AssetCategory>(
      `/assets/categories/${categoryId}`,
      input,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async setCategoryActive(
    categoryId: string,
    isActive: boolean,
  ): Promise<AssetCategory> {
    const action = isActive ? "reactivate" : "deactivate";
    const { data } = await apiClient.post<AssetCategory>(
      `/assets/categories/${categoryId}/${action}`,
    );
    return data;
  },

  async list(query: AssetListQuery): Promise<PagedAssets> {
    const { data } = await apiClient.get<PagedAssets>("/assets", {
      params: query,
    });
    return data;
  },

  async get(assetId: string): Promise<Asset> {
    const { data } = await apiClient.get<Asset>(`/assets/${assetId}`);
    return data;
  },

  async create(input: CreateAssetInput): Promise<Asset> {
    const { data } = await apiClient.post<Asset>("/assets", input);
    return data;
  },

  async updateProfile(
    assetId: string,
    version: number,
    input: UpdateAssetProfileInput,
  ): Promise<Asset> {
    const { data } = await apiClient.put<Asset>(
      `/assets/${assetId}/profile`,
      input,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },
};
