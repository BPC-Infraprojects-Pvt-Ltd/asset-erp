import { apiClient } from "../../lib/api/client";
import type { UserRole } from "../../lib/api/auth-contract";

export interface ManagedUser {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  locationScopes: {
    id: string;
    locationId: string;
    location: { code: string; name: string };
  }[];
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  temporaryPassword: string;
  role: UserRole;
}

export const usersApi = {
  async list(): Promise<ManagedUser[]> {
    const { data } = await apiClient.get<ManagedUser[]>("/users");
    return data;
  },

  async create(input: CreateUserInput): Promise<ManagedUser> {
    const { data } = await apiClient.post<ManagedUser>("/users", input);
    return data;
  },

  async changeRole(userId: string, role: UserRole): Promise<ManagedUser> {
    const { data } = await apiClient.patch<ManagedUser>(
      `/users/${userId}/role`,
      { role },
    );
    return data;
  },

  async resetPassword(
    userId: string,
    temporaryPassword: string,
  ): Promise<ManagedUser> {
    const { data } = await apiClient.post<ManagedUser>(
      `/users/${userId}/reset-password`,
      { temporaryPassword },
    );
    return data;
  },

  async setLocationScopes(
    userId: string,
    locationIds: string[],
  ): Promise<ManagedUser> {
    const { data } = await apiClient.put<ManagedUser>(
      `/users/${userId}/location-scope`,
      { locationIds },
    );
    return data;
  },

  async deactivate(userId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}`);
  },
};
