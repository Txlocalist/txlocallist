import { AdminShell } from "../AdminShell";
import { requireAdmin } from "@/lib/auth/session";
import { StaffCreateForm } from "../StaffCreateForm";
import { reconcileStripeSubscriptionsAction } from "@/app/actions/admin";
import styles from "@/app/dashboard/dashboard.module.css";

export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <AdminShell activeTab="settings">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Admin Tools</h1>
          <p className={styles.pageSubtitle}>Platform management and account creation</p>
        </div>
      </div>

      <div className={styles.card} style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "var(--font-display), cursive", color: "var(--retro-brown)", marginTop: 0 }}>
          Create Staff Account
        </h2>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
          Create a Manager by default, or choose Admin for full platform control. These credentials bypass public signup.
        </p>
        <StaffCreateForm />
      </div>

      <div className={styles.card} style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "var(--font-display), cursive", color: "var(--retro-brown)", marginTop: 0 }}>
          Stripe Reconciliation
        </h2>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
          Pull current subscription status and billing periods from Stripe. Webhooks remain the normal update path.
        </p>
        <form action={reconcileStripeSubscriptionsAction}>
          <button type="submit" className={styles.actionButtonSecondary}>
            Reconcile Subscriptions
          </button>
        </form>
      </div>

      <div className={styles.card} style={{ borderLeft: "4px solid var(--retro-red)" }}>
        <h2 style={{ fontFamily: "var(--font-display), cursive", color: "var(--retro-red)", marginTop: 0 }}>
          Danger Zone
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
          Destructive operations will be added here in a future phase (bulk archive, data exports, etc.).
        </p>
      </div>
    </AdminShell>
  );
}
