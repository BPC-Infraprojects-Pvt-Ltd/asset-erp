import { useAuthStore } from "../auth/auth-store";

export function OverviewPage() {
  const user = useAuthStore((state) => state.session?.user);

  return (
    <section className="overview">
      <div className="page-heading">
        <p className="eyebrow">Overview</p>
        <h1>IT &amp; communications assets</h1>
        <p className="page-description">
          Welcome, {user?.displayName}. This workspace will bring together
          equipment, software, subscriptions, and communication services.
        </p>
      </div>

      <div className="setup-notice" role="status">
        <span className="notice-indicator" aria-hidden="true" />
        <div>
          <h2>Application foundation initialized</h2>
          <p>
            Business workflows are not enabled yet. No sample records or demo
            administrator account are created. Create the initial organization
            and administrator with the one-time bootstrap command. Product
            policies and durable server features will be added in approved
            increments.
          </p>
        </div>
      </div>
    </section>
  );
}
