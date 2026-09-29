import { requireAdmin } from "@/lib/auth/session";
import { getImportAdminState, getImportTaxonomy } from "@/lib/imported-businesses";
import { AdminShell } from "../AdminShell";
import BusinessImportManager from "./BusinessImportManager";
import styles from "@/app/dashboard/dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function OtherBusinessesPage() {
  await requireAdmin();
  const [state, taxonomy] = await Promise.all([getImportAdminState(), getImportTaxonomy()]);
  return <AdminShell activeTab="other-businesses">
    <div className={styles.pageHeader}><div>
      <h1 className={styles.pageTitle}>Import Businesses</h1>
      <p className={styles.pageSubtitle}>Manage the simple business listings shown below subscribed listings.</p>
    </div></div>
    <BusinessImportManager initialState={state} taxonomy={taxonomy} />
  </AdminShell>;
}
