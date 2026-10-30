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
export type AssetCriticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AssetCategorySpecificationField {
  key: string;
  label: string;
  required: boolean;
}

export interface AssetCategory {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  trackingMode: "INDIVIDUAL" | "QUANTITY";
  specificationFields: AssetCategorySpecificationField[];
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
  trackingMode?: "INDIVIDUAL" | "QUANTITY";
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
  criticality: AssetCriticality | null;
  commissioningDate: string | null;
  purchaseDate: string | null;
  warrantyExpiresOn: string | null;
  warrantyReference: string | null;
  sourceReference: string | null;
  notes: string | null;
  specifications: Record<string, string> | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    code: string;
    name: string;
    specificationFields: AssetCategorySpecificationField[];
  };
  location: { id: string; code: string; name: string };
}

export interface AssetHistoryEvent {
  id: string;
  eventType:
    | "REGISTERED"
    | "COMMISSIONED"
    | "PROFILE_UPDATED"
    | "RELATIONSHIP_ADDED"
    | "RELATIONSHIP_REMOVED"
    | "TRANSFER_DISPATCHED"
    | "TRANSFER_RECEIVED"
    | "TRANSFER_EXCEPTION"
    | "COMPONENT_INSTALLED"
    | "COMPONENT_REMOVED"
    | "VERIFICATION_RECONCILED"
    | "RETIREMENT_REQUESTED";
  details: {
    source?: string;
    fields?: string[];
    commissioningDate?: string;
    relatedAssetId?: string;
    role?: string;
    transferId?: string;
    destinationLocationId?: string;
    result?: "RECEIVED" | "MISSING" | "REJECTED";
    componentAssetId?: string;
    hostAssetId?: string;
    installationId?: string;
    campaignId?: string;
    observationId?: string;
    verification?: AssetVerification;
    retirementRequestId?: string;
  } | null;
  occurredAt: string;
  actor: { displayName: string };
}

export interface AssetRelationship {
  id: string;
  organizationId: string;
  parentAssetId: string;
  childAssetId: string;
  createdAt: string;
  endedAt: string | null;
  parentAsset: {
    id: string;
    assetTag: string;
    category: { code: string; name: string };
  };
  childAsset: {
    id: string;
    assetTag: string;
    category: { code: string; name: string };
  };
}

export interface AssetComponentInstallation {
  id: string;
  organizationId: string;
  hostAssetId: string;
  componentAssetId: string;
  installedByUserId: string;
  installedAt: string;
  installNote: string | null;
  removedByUserId: string | null;
  removedAt: string | null;
  removalNote: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  hostAsset: {
    id: string;
    assetTag: string;
    lifecycle: AssetLifecycle;
    availability: AssetAvailability;
    category: { code: string; name: string };
    location: { id: string; code: string; name: string };
  };
  componentAsset: {
    id: string;
    assetTag: string;
    lifecycle: AssetLifecycle;
    availability: AssetAvailability;
    category: { code: string; name: string };
    location: { id: string; code: string; name: string };
  };
  installedBy: { displayName: string };
  removedBy: { displayName: string } | null;
}

export interface InstallAssetComponentInput {
  componentAssetId: string;
  installNote?: string;
}

export interface RemoveAssetComponentInput {
  removalNote?: string;
}

export interface CreateAssetCategoryInput {
  code: string;
  name: string;
  trackingMode?: "INDIVIDUAL" | "QUANTITY";
  specificationFields?: AssetCategorySpecificationField[];
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
  criticality?: AssetCriticality;
  criticality?: AssetCriticality;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  sourceReference?: string;
  notes?: string;
  specifications?: Record<string, string>;
  purchaseDate?: string;
  warrantyExpiresOn?: string;
  warrantyReference?: string;
  criticality: AssetCriticality | "";
}

export interface AssetListQuery {
  page: number;
  pageSize: number;
  search?: string;
  assetIdExact?: string;
  locationId?: string;
  categoryId?: string;
  lifecycle?: AssetLifecycle;
  availability?: AssetAvailability;
  condition?: AssetCondition;
  verification?: AssetVerification;
  serialNumberExact?: string;
  warrantyExpiresOnFrom?: string;
  warrantyExpiresOnTo?: string;
}

export interface UpdateAssetProfileInput {
  manufacturer: string;
  model: string;
  serialNumber: string;
  sourceReference: string;
  notes: string;
  specifications?: Record<string, string>;
  purchaseDate?: string | null;
  warrantyExpiresOn?: string | null;
  warrantyReference?: string;
  criticality: AssetCriticality | "";
}

export interface PagedAssets {
  items: Asset[];
  page: number;
  pageSize: number;
  total: number;
}

export type AssetReservationStatus =
  "SCHEDULED" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export interface AssetReservation {
  id: string;
  organizationId: string;
  assetId: string;
  employeeId: string;
  startDate: string;
  expiresOn: string;
  reason: string;
  createdByUserId: string;
  cancelledByUserId: string | null;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  status: AssetReservationStatus;
  asset: {
    id: string;
    assetTag: string;
    location: { id: string; code: string; name: string };
    category: { id: string; code: string; name: string };
  };
  employee: {
    id: string;
    employeeNumber: string;
    displayName: string;
  };
}

export interface PagedAssetReservations {
  items: AssetReservation[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AssetReservationListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface CreateAssetReservationInput {
  assetId: string;
  employeeId: string;
  startDate: string;
  expiresOn: string;
  reason: string;
}

export type AssetAssignmentStatus = "OPEN" | "OVERDUE" | "RETURNED";

export interface AssetAssignment {
  id: string;
  organizationId: string;
  assetId: string;
  recipientType: "EMPLOYEE" | "TEAM" | "SHARED_POOL";
  employeeId: string | null;
  recipientLabel: string | null;
  issuedByUserId: string;
  issuedAt: string;
  expectedReturnDate: string | null;
  conditionAtIssue: AssetCondition;
  accessoriesAtIssue: string | null;
  purpose: string;
  acknowledgedAt: string | null;
  returnedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  status: AssetAssignmentStatus;
  acknowledgementStatus: "PENDING" | "ACKNOWLEDGED";
  asset: {
    id: string;
    assetTag: string;
    location: { id: string; code: string; name: string };
    category: { id: string; code: string; name: string };
  };
  employee: {
    id: string;
    employeeNumber: string;
    displayName: string;
  } | null;
  returnRecord: {
    id: string;
    returnedAt: string;
    conditionAtReturn: AssetCondition;
    accessoriesReturned: string | null;
    missingItems: string | null;
    followUp: string | null;
    inspectionRequired: boolean;
    receivedBy: { displayName: string };
  } | null;
}

export interface PagedAssetAssignments {
  items: AssetAssignment[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AssetAssignmentListQuery {
  page: number;
  pageSize: number;
  search?: string;
  includeClosed?: boolean;
}

export interface CreateAssetAssignmentInput {
  assetId: string;
  recipientType: "EMPLOYEE" | "TEAM" | "SHARED_POOL";
  employeeId?: string;
  recipientLabel?: string;
  expectedReturnDate?: string;
  conditionAtIssue: AssetCondition;
  accessoriesAtIssue?: string;
  purpose: string;
}

export interface ReturnAssetAssignmentInput {
  conditionAtReturn: AssetCondition;
  accessoriesReturned?: string;
  missingItems?: string;
  followUp?: string;
  inspectionRequired: boolean;
}

export type AssetTransferStatus =
  "DRAFT" | "IN_TRANSIT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
export type AssetTransferLineStatus =
  "DRAFT" | "IN_TRANSIT" | "RECEIVED" | "MISSING" | "REJECTED" | "CANCELLED";

export interface AssetTransferLine {
  id: string;
  assetId: string;
  assetVersionAtCreate: number;
  assetVersionAtDispatch: number | null;
  status: AssetTransferLineStatus;
  version: number;
  receivedAt: string | null;
  conditionAtReceipt: AssetCondition | null;
  inspectionRequired: boolean | null;
  exceptionNote: string | null;
  asset: {
    id: string;
    assetTag: string;
    condition: AssetCondition;
    availability: AssetAvailability;
    location: { id: string; code: string; name: string };
    category: { code: string; name: string };
  };
}

export interface AssetTransfer {
  id: string;
  organizationId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  reason: string;
  status: AssetTransferStatus;
  requestedByUserId: string;
  version: number;
  dispatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceLocation: { id: string; code: string; name: string };
  destinationLocation: { id: string; code: string; name: string };
  lines: AssetTransferLine[];
}

export interface PagedAssetTransfers {
  items: AssetTransfer[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AssetTransferListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface CreateAssetTransferInput {
  destinationLocationId: string;
  assetIds: string[];
  reason: string;
}

export interface ReceiveAssetTransferLineInput {
  result: "RECEIVED" | "MISSING" | "REJECTED";
  conditionAtReceipt?: AssetCondition;
  inspectionRequired?: boolean;
  exceptionNote?: string;
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

  async listReservations(
    query: AssetReservationListQuery,
  ): Promise<PagedAssetReservations> {
    const { data } = await apiClient.get<PagedAssetReservations>(
      "/reservations",
      { params: query },
    );
    return data;
  },

  async createReservation(
    input: CreateAssetReservationInput,
    idempotencyKey: string,
  ): Promise<AssetReservation> {
    const { data } = await apiClient.post<AssetReservation>(
      "/reservations",
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  async cancelReservation(
    reservationId: string,
    version: number,
  ): Promise<AssetReservation> {
    const { data } = await apiClient.post<AssetReservation>(
      `/reservations/${reservationId}/cancel`,
      undefined,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async listAssignments(
    query: AssetAssignmentListQuery,
  ): Promise<PagedAssetAssignments> {
    const { data } = await apiClient.get<PagedAssetAssignments>(
      "/assignments",
      { params: query },
    );
    return data;
  },

  async createAssignment(
    input: CreateAssetAssignmentInput,
    idempotencyKey: string,
  ): Promise<AssetAssignment> {
    const { data } = await apiClient.post<AssetAssignment>(
      "/assignments",
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  async returnAssignment(
    assignmentId: string,
    version: number,
    idempotencyKey: string,
    input: ReturnAssetAssignmentInput,
  ): Promise<AssetAssignment> {
    const { data } = await apiClient.post<AssetAssignment>(
      `/assignments/${assignmentId}/return`,
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

  async listTransfers(
    query: AssetTransferListQuery,
  ): Promise<PagedAssetTransfers> {
    const { data } = await apiClient.get<PagedAssetTransfers>("/transfers", {
      params: query,
    });
    return data;
  },

  async createTransfer(
    input: CreateAssetTransferInput,
    idempotencyKey: string,
  ): Promise<AssetTransfer> {
    const { data } = await apiClient.post<AssetTransfer>("/transfers", input, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return data;
  },

  async dispatchTransfer(
    transferId: string,
    version: number,
  ): Promise<AssetTransfer> {
    const { data } = await apiClient.post<AssetTransfer>(
      `/transfers/${transferId}/dispatch`,
      undefined,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async cancelTransfer(
    transferId: string,
    version: number,
  ): Promise<AssetTransfer> {
    const { data } = await apiClient.post<AssetTransfer>(
      `/transfers/${transferId}/cancel`,
      undefined,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async receiveTransferLine(
    transferId: string,
    lineId: string,
    version: number,
    idempotencyKey: string,
    input: ReceiveAssetTransferLineInput,
  ): Promise<AssetTransfer> {
    const { data } = await apiClient.post<AssetTransfer>(
      `/transfers/${transferId}/lines/${lineId}/receive`,
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

  async commission(
    assetId: string,
    version: number,
    commissioningDate: string,
  ): Promise<Asset> {
    const { data } = await apiClient.post<Asset>(
      `/assets/${assetId}/commission`,
      { commissioningDate },
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async history(assetId: string): Promise<AssetHistoryEvent[]> {
    const { data } = await apiClient.get<AssetHistoryEvent[]>(
      `/assets/${assetId}/history`,
    );
    return data;
  },

  async relationships(assetId: string): Promise<AssetRelationship[]> {
    const { data } = await apiClient.get<AssetRelationship[]>(
      `/assets/${assetId}/relationships`,
    );
    return data;
  },

  async addChildRelationship(
    assetId: string,
    childAssetId: string,
  ): Promise<AssetRelationship> {
    const { data } = await apiClient.post<AssetRelationship>(
      `/assets/${assetId}/relationships`,
      { childAssetId },
    );
    return data;
  },

  async endRelationship(
    assetId: string,
    relationshipId: string,
  ): Promise<AssetRelationship> {
    const { data } = await apiClient.post<AssetRelationship>(
      `/assets/${assetId}/relationships/${relationshipId}/end`,
    );
    return data;
  },

  async componentInstallations(
    assetId: string,
  ): Promise<AssetComponentInstallation[]> {
    const { data } = await apiClient.get<AssetComponentInstallation[]>(
      `/assets/${assetId}/components`,
    );
    return data;
  },

  async installComponent(
    assetId: string,
    input: InstallAssetComponentInput,
    idempotencyKey: string,
  ): Promise<AssetComponentInstallation> {
    const { data } = await apiClient.post<AssetComponentInstallation>(
      `/assets/${assetId}/components/install`,
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  async removeComponent(
    assetId: string,
    installationId: string,
    version: number,
    idempotencyKey: string,
    input: RemoveAssetComponentInput,
  ): Promise<AssetComponentInstallation> {
    const { data } = await apiClient.post<AssetComponentInstallation>(
      `/assets/${assetId}/components/${installationId}/remove`,
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
