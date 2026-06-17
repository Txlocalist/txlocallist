import { redirect } from "next/navigation";
import { DashboardLayout } from "../DashboardShell";
import styles from "../dashboard.module.css";
import { getCurrentSession } from "@/lib/auth/session";

/**
 * Account settings page.
 */
export default async function SettingsPage() {
  const session = await getCurrentSession();

  if (!session || !session.user) {
    redirect("/login");
  }

  const user = session.user;

  return (
    <DashboardLayout activeTab="settings">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Account Settings</h1>
          <p className={styles.pageSubtitle}>
            Manage your profile and preferences
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Profile Information</h2>
        <div className={styles.settingItem}>
          <div>
            <p className={styles.settingLabel}>Name</p>
            <p className={styles.settingValue}>{user.email}</p>
          </div>
        </div>
        <div className={styles.settingItem}>
          <div>
            <p className={styles.settingLabel}>Email</p>
            <p className={styles.settingValue}>{user.email}</p>
          </div>
        </div>
        <div className={styles.settingItem}>
          <div>
            <p className={styles.settingLabel}>Account Type</p>
            <p className={styles.settingValue}>{user.role}</p>
          </div>
        </div>
        <button className={styles.settingButton}>Edit Profile</button>
      </div>

      {/* Security Section */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Security</h2>
        <div className={styles.settingItem}>
          <div>
            <p className={styles.settingLabel}>Password</p>
            <p className={styles.settingValue}>Last changed 90 days ago</p>
          </div>
        </div>
        <button className={styles.settingButton}>Change Password</button>
      </div>

      {/* Notifications Section */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Notifications</h2>
        <div className={styles.settingItem}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" defaultChecked />
            <span>Email me about new inquiry on my listings</span>
          </label>
        </div>
        <div className={styles.settingItem}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" defaultChecked />
            <span>Email me about billing updates and renewals</span>
          </label>
        </div>
        <div className={styles.settingItem}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" />
            <span>Email me about new features and improvements</span>
          </label>
        </div>
      </div>

      {/* Danger Zone */}
      <div className={styles.card} style={{ borderColor: "#d64733", borderWidth: "2px" }}>
        <h2 className={styles.cardTitle} style={{ color: "#d64733" }}>
          Danger Zone
        </h2>
        <p className={styles.settingDescription}>
          Irreversible and destructive actions
        </p>
        <button className={styles.dangerButton}>
          Delete Account
        </button>
      </div>
    </DashboardLayout>
  );
}
