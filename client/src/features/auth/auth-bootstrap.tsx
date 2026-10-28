import { isAxiosError } from "axios";
import { useEffect, useState, type ReactNode } from "react";
import { authApi } from "./auth-api";
import { useAuthStore } from "./auth-store";

let refreshSessionRequest: ReturnType<typeof authApi.refresh> | undefined;

function refreshSessionOnce() {
  refreshSessionRequest ??= authApi
    .refresh()
    .finally(() => (refreshSessionRequest = undefined));
  return refreshSessionRequest;
}

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const startInitialization = useAuthStore(
    (state) => state.startInitialization,
  );
  const setSession = useAuthStore((state) => state.setSession);
  const setAnonymous = useAuthStore((state) => state.setAnonymous);
  const setInitializationError = useAuthStore(
    (state) => state.setInitializationError,
  );

  useEffect(() => {
    let active = true;
    startInitialization();

    void (async () => {
      try {
        const session = await refreshSessionOnce();
        if (!active) return;
        setSession(session);

        const identity = await authApi.me();
        if (active) {
          setSession({
            ...session,
            user: identity.user,
          });
        }
      } catch (requestError) {
        if (!active) return;
        if (
          isAxiosError(requestError) &&
          requestError.response?.status === 401
        ) {
          setAnonymous();
          return;
        }
        setInitializationError(
          "The application could not verify your session. Check the connection and try again.",
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [
    attempt,
    setAnonymous,
    setInitializationError,
    setSession,
    startInitialization,
  ]);

  if (status === "initializing") {
    return (
      <main className="auth-loading" role="status">
        Checking your session…
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="auth-loading" role="alert">
        <p>{error}</p>
        <button
          className="button button-secondary"
          onClick={() => {
            startInitialization();
            setAttempt((value) => value + 1);
          }}
          type="button"
        >
          Retry
        </button>
      </main>
    );
  }

  return children;
}
