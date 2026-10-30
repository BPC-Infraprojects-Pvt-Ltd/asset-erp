import type { AxiosProgressEvent } from "axios";
import { apiClient } from "../../lib/api/client";

export type AssetImportStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "PREVIEW_READY"
  | "FAILED"
  | "COMMITTING"
  | "COMMITTED";

export interface AssetImportJob {
  id: string;
  organizationId: string;
  createdByUserId: string;
  status: AssetImportStatus;
  fileChecksum: string;
  totalRows: number;
  validRows: number;
  errorCount: number;
  createdCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  committedAt: string | null;
}

export interface AssetImportRowError {
  id?: string;
  importJobId?: string;
  rowNumber: number;
  fieldName: string;
  code: string;
  message: string;
  createdAt?: string;
}

export interface AssetImportSampleRow {
  rowNumber: number;
  assetTag: string;
  categoryCode: string;
  locationCode: string;
  availability: string;
  condition: string;
}

export interface PagedAssetImports {
  items: AssetImportJob[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AssetImportPreviewResult {
  job: AssetImportJob;
  errors: AssetImportRowError[];
  sampleRows: AssetImportSampleRow[];
}

export interface AssetImportCommitResult {
  job: AssetImportJob;
  errors: AssetImportRowError[];
}

export const assetImportsApi = {
  async list(page = 1, pageSize = 20): Promise<PagedAssetImports> {
    const { data } = await apiClient.get<PagedAssetImports>("/imports", {
      params: { page, pageSize },
    });
    return data;
  },

  async get(importJobId: string): Promise<AssetImportJob> {
    const { data } = await apiClient.get<AssetImportJob>(
      `/imports/${importJobId}`,
    );
    return data;
  },

  async errors(importJobId: string): Promise<AssetImportRowError[]> {
    const { data } = await apiClient.get<AssetImportRowError[]>(
      `/imports/${importJobId}/errors`,
    );
    return data;
  },

  async preview(
    file: File,
    idempotencyKey: string,
    onUploadProgress?: (progress: AxiosProgressEvent) => void,
  ): Promise<AssetImportPreviewResult> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post<AssetImportPreviewResult>(
      "/imports/assets/preview",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          "Idempotency-Key": idempotencyKey,
        },
        onUploadProgress,
      },
    );
    return data;
  },

  async commit(
    importJobId: string,
    version: number,
    file: File,
    idempotencyKey: string,
    onUploadProgress?: (progress: AxiosProgressEvent) => void,
  ): Promise<AssetImportCommitResult> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post<AssetImportCommitResult>(
      `/imports/${importJobId}/commit`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          "If-Match": `"${version}"`,
          "Idempotency-Key": idempotencyKey,
        },
        onUploadProgress,
      },
    );
    return data;
  },
};
