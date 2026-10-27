import { create } from "zustand";
import type { AuthSession } from "../../lib/api/auth-contract";

type AuthStatus = "initializing" | "authenticated" | "anonymous" | "error";

interface AuthState {
  session: AuthSession | null;
  status: AuthStatus;
  generation: number;
  error: string | null;
  notice: string | null;
  setSession: (session: AuthSession) => void;
  setAnonymous: (notice?: string) => void;
  setInitializationError: (message: string) => void;
  startInitialization: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  status: "initializing",
  generation: 0,
  error: null,
  notice: null,
  setSession: (session) => {
    const current = get();
    const sameIdentity =
      current.session?.user.id === session.user.id &&
      current.session.user.organizationId === session.user.organizationId;
    set({
      session,
      status: "authenticated",
      generation: sameIdentity ? current.generation : current.generation + 1,
      error: null,
      notice: null,
    });
  },
  setAnonymous: (notice) =>
    set((state) => ({
      session: null,
      status: "anonymous",
      generation: state.generation + 1,
      error: null,
      notice: notice ?? null,
    })),
  setInitializationError: (message) => set({ status: "error", error: message }),
  startInitialization: () => set({ status: "initializing", error: null }),
}));

export function protectedQueryKey(
  feature: string,
  ...key: readonly unknown[]
): readonly unknown[] {
  const { session, generation } = useAuthStore.getState();
  return [
    "protected",
    session?.user.organizationId ?? null,
    session?.user.id ?? null,
    generation,
    feature,
    ...key,
  ];
}
