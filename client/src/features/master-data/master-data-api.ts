import { apiClient } from "../../lib/api/client";

export interface OrganizationMasterRecord {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PagedOrganizationMasterRecords {
  items: OrganizationMasterRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OrganizationMasterListQuery {
  page: number;
  pageSize: number;
  search?: string;
  includeInactive?: boolean;
}

export interface OrganizationMasterInput {
  code: string;
  name: string;
}

export interface ManufacturerRecord {
  id: string;
  organizationId: string;
  name: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetModelRecord {
  id: string;
  organizationId: string;
  manufacturerId: string;
  name: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  manufacturer: { id: string; name: string };
}

export interface EmployeeRecord {
  id: string;
  organizationId: string;
  employeeNumber: string;
  displayName: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManufacturerInput {
  name: string;
}

export interface AssetModelInput {
  manufacturerId: string;
  name: string;
}

export interface EmployeeInput {
  employeeNumber: string;
  displayName: string;
}

export interface PagedRecords<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AssetModelListQuery extends OrganizationMasterListQuery {
  manufacturerId?: string;
}

export type OrganizationMasterKind = "department" | "cost-center";

const resourcePath: Record<OrganizationMasterKind, string> = {
  department: "/master/departments",
  "cost-center": "/master/cost-centers",
};

export const masterDataApi = {
  async list(
    kind: OrganizationMasterKind,
    query: OrganizationMasterListQuery,
  ): Promise<PagedOrganizationMasterRecords> {
    const { data } = await apiClient.get<PagedOrganizationMasterRecords>(
      resourcePath[kind],
      { params: query },
    );
    return data;
  },

  async create(
    kind: OrganizationMasterKind,
    input: OrganizationMasterInput,
  ): Promise<OrganizationMasterRecord> {
    const { data } = await apiClient.post<OrganizationMasterRecord>(
      resourcePath[kind],
      input,
    );
    return data;
  },

  async get(
    kind: OrganizationMasterKind,
    id: string,
  ): Promise<OrganizationMasterRecord> {
    const { data } = await apiClient.get<OrganizationMasterRecord>(
      `${resourcePath[kind]}/${id}`,
    );
    return data;
  },

  async update(
    kind: OrganizationMasterKind,
    id: string,
    version: number,
    input: OrganizationMasterInput,
  ): Promise<OrganizationMasterRecord> {
    const { data } = await apiClient.put<OrganizationMasterRecord>(
      `${resourcePath[kind]}/${id}`,
      input,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async setActive(
    kind: OrganizationMasterKind,
    id: string,
    version: number,
    isActive: boolean,
  ): Promise<OrganizationMasterRecord> {
    const action = isActive ? "reactivate" : "deactivate";
    const { data } = await apiClient.post<OrganizationMasterRecord>(
      `${resourcePath[kind]}/${id}/${action}`,
      undefined,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async listManufacturers(
    query: OrganizationMasterListQuery,
  ): Promise<PagedRecords<ManufacturerRecord>> {
    const { data } = await apiClient.get<PagedRecords<ManufacturerRecord>>(
      "/master/manufacturers",
      { params: query },
    );
    return data;
  },

  async getManufacturer(id: string): Promise<ManufacturerRecord> {
    const { data } = await apiClient.get<ManufacturerRecord>(
      `/master/manufacturers/${id}`,
    );
    return data;
  },

  async createManufacturer(
    input: ManufacturerInput,
  ): Promise<ManufacturerRecord> {
    const { data } = await apiClient.post<ManufacturerRecord>(
      "/master/manufacturers",
      input,
    );
    return data;
  },

  async updateManufacturer(
    id: string,
    version: number,
    input: ManufacturerInput,
  ): Promise<ManufacturerRecord> {
    const { data } = await apiClient.put<ManufacturerRecord>(
      `/master/manufacturers/${id}`,
      input,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async setManufacturerActive(
    id: string,
    version: number,
    isActive: boolean,
  ): Promise<ManufacturerRecord> {
    const action = isActive ? "reactivate" : "deactivate";
    const { data } = await apiClient.post<ManufacturerRecord>(
      `/master/manufacturers/${id}/${action}`,
      undefined,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async listAssetModels(
    query: AssetModelListQuery,
  ): Promise<PagedRecords<AssetModelRecord>> {
    const { data } = await apiClient.get<PagedRecords<AssetModelRecord>>(
      "/master/asset-models",
      { params: query },
    );
    return data;
  },

  async createAssetModel(input: {
    manufacturerId: string;
    name: string;
  }): Promise<AssetModelRecord> {
    const { data } = await apiClient.post<AssetModelRecord>(
      "/master/asset-models",
      input,
    );
    return data;
  },

  async getAssetModel(id: string): Promise<AssetModelRecord> {
    const { data } = await apiClient.get<AssetModelRecord>(
      `/master/asset-models/${id}`,
    );
    return data;
  },

  async updateAssetModel(
    id: string,
    version: number,
    input: AssetModelInput,
  ): Promise<AssetModelRecord> {
    const { data } = await apiClient.put<AssetModelRecord>(
      `/master/asset-models/${id}`,
      input,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async setAssetModelActive(
    id: string,
    version: number,
    isActive: boolean,
  ): Promise<AssetModelRecord> {
    const action = isActive ? "reactivate" : "deactivate";
    const { data } = await apiClient.post<AssetModelRecord>(
      `/master/asset-models/${id}/${action}`,
      undefined,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async listEmployees(
    query: OrganizationMasterListQuery,
  ): Promise<PagedRecords<EmployeeRecord>> {
    const { data } = await apiClient.get<PagedRecords<EmployeeRecord>>(
      "/master/employees",
      { params: query },
    );
    return data;
  },

  async getEmployee(id: string): Promise<EmployeeRecord> {
    const { data } = await apiClient.get<EmployeeRecord>(
      `/master/employees/${id}`,
    );
    return data;
  },

  async createEmployee(input: EmployeeInput): Promise<EmployeeRecord> {
    const { data } = await apiClient.post<EmployeeRecord>(
      "/master/employees",
      input,
    );
    return data;
  },

  async updateEmployee(
    id: string,
    version: number,
    input: EmployeeInput,
  ): Promise<EmployeeRecord> {
    const { data } = await apiClient.put<EmployeeRecord>(
      `/master/employees/${id}`,
      input,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },

  async setEmployeeActive(
    id: string,
    version: number,
    isActive: boolean,
  ): Promise<EmployeeRecord> {
    const action = isActive ? "reactivate" : "deactivate";
    const { data } = await apiClient.post<EmployeeRecord>(
      `/master/employees/${id}/${action}`,
      undefined,
      { headers: { "If-Match": `"${version}"` } },
    );
    return data;
  },
};
