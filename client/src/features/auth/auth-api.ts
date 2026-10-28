import { apiClient } from "../../lib/api/client";
import type { AuthIdentity, AuthSession } from "../../lib/api/auth-contract";

export interface LoginInput {
  organizationId: string;
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>("/auth/login", input, {
      _skipAuthRefresh: true,
    });
    return data;
  },

  async refresh(): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>(
      "/auth/refresh",
      undefined,
      { _skipAuthRefresh: true },
    );
    return data;
  },

  async me(): Promise<AuthIdentity> {
    const { data } = await apiClient.get<AuthIdentity>("/auth/me");
    return data;
  },

  async logout(): Promise<void> {
    await apiClient.post("/auth/logout", undefined, {
      _skipAuthRefresh: true,
    });
  },

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await apiClient.post("/auth/password/change", input);
  },
};
