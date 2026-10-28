import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthBootstrap } from "./features/auth/auth-bootstrap";
import { clearProtectedCache } from "./features/auth/auth-cache";
import { useAuthStore } from "./features/auth/auth-store";
import { configureAuthTransport } from "./lib/api/client";
import { router } from "./router";
import "./index.css";

const queryClient = new QueryClient();

configureAuthTransport({
  getAccessToken: () => useAuthStore.getState().session?.accessToken ?? null,
  setSession: async (session) => {
    const current = useAuthStore.getState().session;
    if (
      current &&
      (current.user.id !== session.user.id ||
        current.user.organizationId !== session.user.organizationId)
    ) {
      await clearProtectedCache(queryClient);
    }
    useAuthStore.getState().setSession(session);
  },
  onSessionExpired: async () => {
    await clearProtectedCache(queryClient);
    useAuthStore
      .getState()
      .setAnonymous("Your session expired. Sign in again to continue.");
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
    </QueryClientProvider>
  </StrictMode>,
);
