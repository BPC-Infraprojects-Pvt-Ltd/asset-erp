import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSession } from "../../lib/api/auth-contract";
import { protectedQueryKey, useAuthStore } from "./auth-store";

function session(userId: string, organizationId: string): AuthSession {
  return {
    accessToken: "memory-only-token",
    expiresIn: 600,
    user: {
      id: userId,
      organizationId,
      email: "person@example.com",
      displayName: "Example Person",
      role: "EMPLOYEE",
      mustChangePassword: false,
      organization: {
        id: organizationId,
        name: "Example Organization",
      },
    },
  };
}

describe("authentication store", () => {
  beforeEach(() => {
    useAuthStore.getState().setAnonymous();
  });

  it("increments the cache generation when identity changes", () => {
    const initialGeneration = useAuthStore.getState().generation;

    useAuthStore.getState().setSession(session("user-a", "org-a"));
    const firstIdentityGeneration = useAuthStore.getState().generation;

    useAuthStore
      .getState()
      .setSession({ ...session("user-a", "org-a"), accessToken: "rotated" });
    expect(useAuthStore.getState().generation).toBe(firstIdentityGeneration);

    useAuthStore.getState().setSession(session("user-b", "org-a"));
    expect(useAuthStore.getState().generation).toBe(
      firstIdentityGeneration + 1,
    );
    expect(firstIdentityGeneration).toBe(initialGeneration + 1);
  });

  it("qualifies protected query keys by organization, actor, and generation", () => {
    useAuthStore.getState().setSession(session("user-a", "org-a"));

    expect(protectedQueryKey("assets", "page", 1)).toEqual([
      "protected",
      "org-a",
      "user-a",
      useAuthStore.getState().generation,
      "assets",
      "page",
      1,
    ]);
  });

  it("keeps the access token only in in-memory session state", () => {
    useAuthStore.getState().setSession(session("user-a", "org-a"));
    expect(useAuthStore.getState().session?.accessToken).toBe(
      "memory-only-token",
    );
    expect(typeof window).toBe("undefined");
  });
});
