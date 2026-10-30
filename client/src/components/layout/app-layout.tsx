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
import { modulePageGroups } from "../../features/modules/module-pages";
import {
  canManageAssetRegister,
  canManageAssetCategories,
  canViewAssetRegister,
} from "../../features/assets/asset-access";

export function AppLayout() {
  const session = useAuthStore((state) => state.session);
  const setAnonymous = useAuthStore((state) => state.setAnonymous);
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const activeModuleGroup = modulePageGroups.find((group) =>
    group.pages.some((page) => pathname === `/modules/${page.id}`),
  )?.id;
  const activeGroupId =
    activeModuleGroup ??
    (pathname === "/asset-categories" ||
    pathname === "/users" ||
    (pathname === "/locations" && session?.user.role === "ADMINISTRATOR")
      ? "administration"
      : pathname.startsWith("/assets") ||
          pathname === "/labels" ||
          pathname === "/reservations" ||
          pathname === "/assignments" ||
          pathname === "/transfers" ||
          pathname === "/stock" ||
          pathname === "/imports" ||
          pathname === "/verification-campaigns" ||
          pathname === "/retirements" ||
          pathname === "/locations"
        ? "hardware"
        : undefined);

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
    pathname === "/asset-categories" &&
    !canManageAssetCategories(session.user.role)
  ) {
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
    !canViewAssetRegister(session.user.role)
  ) {
    return <Navigate to="/" replace />;
  }
  if (pathname === "/labels" && !canManageAssetRegister(session.user.role)) {
    return <Navigate to="/" replace />;
  }
  if (
    pathname === "/reservations" &&
    !canManageAssetRegister(session.user.role)
  ) {
    return <Navigate to="/" replace />;
  }
  if (
    pathname === "/assignments" &&
    !canManageAssetRegister(session.user.role)
  ) {
    return <Navigate to="/" replace />;
  }
  if (pathname === "/transfers" && !canManageAssetRegister(session.user.role)) {
    return <Navigate to="/" replace />;
  }
  if (pathname === "/stock" && !canManageAssetRegister(session.user.role)) {
    return <Navigate to="/" replace />;
  }
  if (pathname === "/imports" && !canManageAssetRegister(session.user.role)) {
    return <Navigate to="/" replace />;
  }
  if (
    pathname === "/verification-campaigns" &&
    !canManageAssetRegister(session.user.role)
  ) {
    return <Navigate to="/" replace />;
  }
  if (
    pathname === "/retirements" &&
    !canManageAssetRegister(session.user.role)
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
            IT
          </span>
          <span>
            <strong>Asset workspace</strong>
            <small>IT &amp; communications</small>
          </span>
        </Link>
        <nav className="primary-nav" aria-label="Main navigation">
          <Link
            activeProps={{ className: "nav-link active" }}
            className="nav-link"
            to="/"
          >
            <span className="nav-link-mark" aria-hidden="true">
              01
            </span>
            <span>Overview</span>
          </Link>
          {modulePageGroups.map((group) => {
            const isAdministration = group.id === "administration";
            if (isAdministration && session.user.role !== "ADMINISTRATOR") {
              return null;
            }

            return (
              <details
                className="nav-group"
                key={group.id}
                open={activeGroupId === group.id || undefined}
              >
                <summary className="nav-group-title">
                  <span>{group.title}</span>
                  <span className="nav-chevron" aria-hidden="true" />
                </summary>
                <div className="nav-group-links">
                  {group.id === "hardware" &&
                    canViewAssetRegister(session.user.role) && (
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
                          warrantyExpiresOnFrom: "",
                          warrantyExpiresOnTo: "",
                        }}
                        to="/assets"
                      >
                        Asset register
                      </Link>
                    )}
                  {group.id === "hardware" &&
                    ["ASSET_MANAGER", "PROCUREMENT_FINANCE"].includes(
                      session.user.role,
                    ) && (
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/locations"
                      >
                        Locations &amp; stores
                      </Link>
                    )}
                  {group.id === "hardware" &&
                    canManageAssetRegister(session.user.role) && (
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/labels"
                      >
                        Labels
                      </Link>
                    )}
                  {group.id === "hardware" &&
                    canManageAssetRegister(session.user.role) && (
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/assignments"
                      >
                        Assignments &amp; returns
                      </Link>
                    )}
                  {group.id === "hardware" &&
                    canManageAssetRegister(session.user.role) && (
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/reservations"
                      >
                        Reservations
                      </Link>
                    )}
                  {group.id === "hardware" &&
                    canManageAssetRegister(session.user.role) && (
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/transfers"
                      >
                        Transfers
                      </Link>
                    )}
                  {group.id === "hardware" &&
                    canManageAssetRegister(session.user.role) && (
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/stock"
                      >
                        Accessories &amp; spare stock
                      </Link>
                    )}
                  {group.id === "hardware" &&
                    canManageAssetRegister(session.user.role) && (
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/imports"
                      >
                        Asset imports
                      </Link>
                    )}
                  {group.id === "hardware" &&
                    canManageAssetRegister(session.user.role) && (
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/verification-campaigns"
                      >
                        Verification campaigns
                      </Link>
                    )}
                  {group.id === "hardware" &&
                    canManageAssetRegister(session.user.role) && (
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/retirements"
                      >
                        Retirement requests
                      </Link>
                    )}
                  {group.id === "administration" && (
                    <>
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/users"
                      >
                        Users &amp; access
                      </Link>
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/locations"
                      >
                        Locations &amp; stores
                      </Link>
                      <Link
                        activeProps={{ className: "nav-link active" }}
                        className="nav-link"
                        to="/asset-categories"
                      >
                        Asset categories
                      </Link>
                    </>
                  )}
                  {group.pages
                    .filter(
                      (page) =>
                        group.id !== "hardware" ||
                        (page.id !== "labels" &&
                          page.id !== "reservations" &&
                          page.id !== "assignments-returns" &&
                          page.id !== "transfers" &&
                          page.id !== "accessories-stock" &&
                          page.id !== "asset-imports" &&
                          page.id !== "verification-campaigns" &&
                          page.id !== "retirement-disposal"),
                    )
                    .map((page) => (
                      <Link
                        className={
                          pathname === `/modules/${page.id}`
                            ? "nav-link active"
                            : "nav-link"
                        }
                        key={page.id}
                        params={{ moduleId: page.id }}
                        search={
                          [
                            "departments-cost-centers",
                            "manufacturers-models",
                            "employees",
                          ].includes(page.id)
                            ? {}
                            : { demo: true }
                        }
                        to="/modules/$moduleId"
                      >
                        {page.title}
                      </Link>
                    ))}
                </div>
              </details>
            );
          })}
        </nav>
        <p className="sidebar-caption">Organization workspace</p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="organization-context">
            <span className="topbar-caption">Organization</span>
            <strong>{session.user.organization.name}</strong>
          </div>
          <div className="account-controls">
            <span className="account-avatar" aria-hidden="true">
              {session.user.displayName
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join("")
                .toUpperCase()}
            </span>
            <span className="account-name">{session.user.displayName}</span>
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
