import { AxiosError, type AxiosAdapter, type AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "./auth-contract";
import { apiClient, configureAuthTransport } from "./client";

describe("shared API authentication transport", () => {
  const originalAdapter = apiClient.defaults.adapter;

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it("shares one refresh request and retries concurrent unauthorized calls", async () => {
    let accessToken = "expired-access-token";
    let refreshCount = 0;
    const refreshedSession: AuthSession = {
      accessToken: "new-access-token",
      expiresIn: 600,
      user: {
        id: "user-a",
        organizationId: "org-a",
        email: "person@example.com",
        displayName: "Example Person",
        role: "EMPLOYEE",
        mustChangePassword: false,
        organization: { id: "org-a", name: "Example Organization" },
      },
    };
    const setSession = vi.fn((session: AuthSession) => {
      accessToken = session.accessToken;
    });
    const onSessionExpired = vi.fn(async () => {});

    configureAuthTransport({
      getAccessToken: () => accessToken,
      setSession,
      onSessionExpired,
    });

    const adapter: AxiosAdapter = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return response(config, refreshedSession, 200);
      }

      if (
        config.url === "/private" &&
        config.headers.get("Authorization") === "Bearer expired-access-token"
      ) {
        const unauthorized = response(config, { status: 401 }, 401);
        throw new AxiosError(
          "Unauthorized",
          "ERR_BAD_REQUEST",
          config,
          undefined,
          unauthorized,
        );
      }

      if (
        config.url === "/private" &&
        config.headers.get("Authorization") === "Bearer new-access-token"
      ) {
        return response(config, { ok: true }, 200);
      }

      throw new Error(`Unexpected request: ${config.url}`);
    };
    apiClient.defaults.adapter = adapter;

    const results = await Promise.all([
      apiClient.get("/private"),
      apiClient.get("/private"),
    ]);

    expect(results.map((result) => result.data)).toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(refreshCount).toBe(1);
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});

function response<T>(
  config: Parameters<AxiosAdapter>[0],
  data: T,
  status: number,
): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? "OK" : "Unauthorized",
    headers: {},
    config,
    request: {},
  };
}
