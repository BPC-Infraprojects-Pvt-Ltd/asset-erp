import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { authApi } from "../../features/auth/auth-api";
import { clearProtectedCache } from "../../features/auth/auth-cache";
import { useAuthStore } from "../../features/auth/auth-store";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function AppLayout() {
  const session = useAuthStore((state) => state.session);
  const setAnonymous = useAuthStore((state) => state.setAnonymous);
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (pathname === "/login") {
    if (session) {
      return (
        <Navigate
          to={session.user.mustChangePassword ? "/password/change" : "/"}
          replace
        />
      );
    }
    return <Outlet />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.user.mustChangePassword && pathname !== "/password/change") {
    return <Navigate to="/password/change" replace />;
  }

  if (pathname === "/users" && session.user.role !== "ADMINISTRATOR") {
    return <Navigate to="/" replace />;
  }

  if (
    pathname === "/locations" &&
    !["ADMINISTRATOR", "ASSET_MANAGER", "PROCUREMENT_FINANCE"].includes(
      session.user.role,
    )
  ) {
    return <Navigate to="/" replace />;
  }

  if (
    pathname.startsWith("/assets") &&
    !["ADMINISTRATOR", "ASSET_MANAGER"].includes(session.user.role)
  ) {
    return <Navigate to="/" replace />;
  }
  if (
    pathname.startsWith("/assets/") &&
    session.user.role !== "ASSET_MANAGER"
  ) {
    return <Navigate to="/" replace />;
  }

  if (pathname === "/password/change") {
    return <Outlet />;
  }

  const logout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    let notice: string | undefined;
    try {
      await authApi.logout();
    } catch {
      notice =
        "The local session was cleared, but server logout could not be confirmed. The refresh cookie may restore the session if you reload.";
    } finally {
      await clearProtectedCache(queryClient);
      setAnonymous(notice);
      await navigate({ to: "/login" });
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">
            IA
          </span>
          <span>
            <strong>Asset management</strong>
            <small>IT &amp; communications</small>
          </span>
        </Link>
        <nav className="primary-nav" aria-label="Main navigation">
          <Link
            activeProps={{ className: "nav-link active" }}
            className="nav-link"
            to="/"
          >
            Overview
          </Link>
          {session.user.role === "ADMINISTRATOR" && (
            <Link
              activeProps={{ className: "nav-link active" }}
              className="nav-link"
              to="/users"
            >
              Users
            </Link>
          )}
          {["ADMINISTRATOR", "ASSET_MANAGER", "PROCUREMENT_FINANCE"].includes(
            session.user.role,
          ) && (
            <Link
              activeProps={{ className: "nav-link active" }}
              className="nav-link"
              to="/locations"
            >
              Locations
            </Link>
          )}
          {["ADMINISTRATOR", "ASSET_MANAGER"].includes(session.user.role) && (
            <Link
              activeProps={{ className: "nav-link active" }}
              className="nav-link"
              search={{
                page: 1,
                search: "",
                locationId: "",
                categoryId: "",
                lifecycle: "",
                availability: "",
                condition: "",
                verification: "",
              }}
              to="/assets"
            >
              Asset register
            </Link>
          )}
        </nav>
        <p className="sidebar-caption">IT &amp; communications</p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>{session.user.organization.name}</span>
          <div className="account-controls">
            <span>{session.user.displayName}</span>
            <button
              className="button button-secondary"
              disabled={isSigningOut}
              onClick={logout}
              type="button"
            >
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
