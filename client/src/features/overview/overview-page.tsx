import { Link } from "@tanstack/react-router";
import { useAuthStore } from "../auth/auth-store";

export function OverviewPage() {
  const user = useAuthStore((state) => state.session?.user);
  const role = user?.role;
  const quickLinks = [
    ...(role === "ADMINISTRATOR" || role === "ASSET_MANAGER"
      ? [
          {
            label: "Asset register",
            to: "/assets" as const,
            description:
              role === "ASSET_MANAGER"
                ? "Search and manage registered equipment."
                : "View registered equipment across the organization.",
          },
        ]
      : []),
    ...(role === "ADMINISTRATOR"
      ? [
          {
            label: "Asset categories",
            to: "/asset-categories" as const,
            description: "Maintain the organization hardware categories.",
          },
        ]
      : []),
    ...(role === "ADMINISTRATOR" ||
    role === "ASSET_MANAGER" ||
    role === "PROCUREMENT_FINANCE"
      ? [
          {
            label: "Locations & stores",
            to: "/locations" as const,
            description: "Review the organization location structure.",
          },
        ]
      : []),
    ...(role === "ADMINISTRATOR"
      ? [
          {
            label: "Users & access",
            to: "/users" as const,
            description: "Manage accounts and assigned access.",
          },
        ]
      : []),
  ];

  return (
    <section className="overview-page">
      <div className="page-heading">
        <p className="eyebrow">Your workspace</p>
        <h1>Welcome back, {user?.displayName}</h1>
        <p className="page-description">
          A clear view of your organization&apos;s IT and communication
          resources, with each workflow connected as it becomes available.
        </p>
      </div>

      <div className="overview-grid">
        <section className="overview-card overview-card-primary">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Connected today</p>
              <h2>Start with your workspace</h2>
            </div>
            <span className="connection-indicator">
              <span aria-hidden="true" />
              Live
            </span>
          </div>
          <p>
            Account access, user administration, location management, and the
            asset register are connected to the application API.
          </p>
          {quickLinks.length ? (
            <div className="overview-quick-links">
              {quickLinks.map((item) => (
                <Link
                  className="overview-link-card"
                  key={item.label}
                  search={
                    item.to === "/assets"
                      ? {
                          page: 1,
                          search: "",
                          locationId: "",
                          categoryId: "",
                          lifecycle: "",
                          availability: "",
                          condition: "",
                          verification: "",
                        }
                      : undefined
                  }
                  to={item.to}
                >
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="overview-link-arrow" aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="overview-empty-links">
              Your role-specific workspace pages are being connected.
            </p>
          )}
        </section>

        <section className="overview-card">
          <p className="eyebrow">Platform status</p>
          <h2>More of the product is taking shape</h2>
          <p>
            Additional module pages show clearly labeled, read-only illustrative
            records until their APIs are connected. They do not change live
            application data.
          </p>
          <div className="overview-status">
            <span className="status-dot status-dot-ready" aria-hidden="true" />
            <span>Current API-backed workspace</span>
            <strong>Connected</strong>
          </div>
          <div className="overview-status">
            <span
              className="status-dot status-dot-pending"
              aria-hidden="true"
            />
            <span>Other product workflows</span>
            <strong>In progress</strong>
          </div>
        </section>
      </div>
    </section>
  );
}
