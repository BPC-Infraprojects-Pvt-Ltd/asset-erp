import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AuthSession } from "./auth-contract";

declare module "axios" {
  interface AxiosRequestConfig {
    _skipAuthRefresh?: boolean;
  }

  interface InternalAxiosRequestConfig {
    _authRetried?: boolean;
    _skipAuthRefresh?: boolean;
  }
}

interface AuthRequestConfig extends InternalAxiosRequestConfig {
  _authRetried?: boolean;
  _skipAuthRefresh?: boolean;
}

interface AuthTransportHandlers {
  getAccessToken: () => string | null;
  setSession: (session: AuthSession) => Promise<void> | void;
  onSessionExpired: () => Promise<void>;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

let authHandlers: AuthTransportHandlers | undefined;
let refreshRequest: Promise<AuthSession> | undefined;

export function configureAuthTransport(handlers: AuthTransportHandlers): void {
  authHandlers = handlers;
}

apiClient.interceptors.request.use((config) => {
  const token = authHandlers?.getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as AuthRequestConfig | undefined;
    if (
      error.response?.status !== 401 ||
      !config ||
      config._authRetried ||
      config._skipAuthRefresh ||
      config.url?.includes("/auth/login") ||
      config.url?.includes("/auth/refresh") ||
      !authHandlers
    ) {
      return Promise.reject(error);
    }

    config._authRetried = true;
    const handlers = authHandlers;
    try {
      refreshRequest ??= apiClient
        .post<AuthSession>("/auth/refresh", undefined, {
          _skipAuthRefresh: true,
        } as AuthRequestConfig)
        .then(async ({ data }) => {
          await handlers.setSession(data);
          return data;
        })
        .finally(() => {
          refreshRequest = undefined;
        });

      const session = await refreshRequest;
      config.headers.set("Authorization", `Bearer ${session.accessToken}`);
      return apiClient.request(config);
    } catch {
      await handlers.onSessionExpired();
      return Promise.reject(error);
    }
  },
);
