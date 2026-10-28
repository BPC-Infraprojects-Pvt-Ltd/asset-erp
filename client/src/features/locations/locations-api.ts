import { apiClient } from "../../lib/api/client";

export interface Location {
  id: string;
  organizationId: string;
  parentLocationId: string | null;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface Store {
  id: string;
  organizationId: string;
  locationId: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  location: { code: string; name: string };
}

export interface CreateLocationInput {
  code: string;
  name: string;
  parentLocationId?: string;
}

export interface CreateStoreInput {
  code: string;
  name: string;
  locationId: string;
}

export const locationsApi = {
  async list(): Promise<Location[]> {
    const { data } = await apiClient.get<Location[]>("/locations");
    return data;
  },

  async create(input: CreateLocationInput): Promise<Location> {
    const { data } = await apiClient.post<Location>("/locations", input);
    return data;
  },

  async listStores(): Promise<Store[]> {
    const { data } = await apiClient.get<Store[]>("/stores");
    return data;
  },

  async createStore(input: CreateStoreInput): Promise<Store> {
    const { data } = await apiClient.post<Store>("/stores", input);
    return data;
  },
};
