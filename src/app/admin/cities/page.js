import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "../AdminShell";
import CityCreateForm from "./CityCreateForm";
import ResultsSort from "@/components/ResultsSort/ResultsSort";
import { resultOrderBy, sortResults } from "@/lib/results-sort";
import styles from "@/app/dashboard/dashboard.module.css";

export default async function AdminCitiesPage({ searchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const cities = await prisma.city.findMany({ orderBy: resultOrderBy(params?.sort, { fallback: "name-asc" }), include: { _count: { select: { businesses: true } } } });
  return <AdminShell activeTab="cities">
    <div className={styles.pageHeader}><div><h1 className={styles.pageTitle}>Cities</h1><p className={styles.pageSubtitle}>Manage the cities available across TX Localist.</p></div></div>
    <div className={styles.card}><h2>Add a Texas city</h2><CityCreateForm /></div>
    <ResultsSort fallback="name-asc" />
    <div className={styles.businessesTable}>
      <div className={styles.tableHeader}><div className={styles.tableCol}>City</div><div className={styles.tableCol}>Slug</div><div className={styles.tableCol}>Businesses</div></div>
      <div className={styles.tableBody}>{sortResults(cities, params?.sort, { fallback: "name-asc" }).map((city) => <div key={city.id} className={styles.tableRow}><div className={styles.tableCol}>{city.name}</div><div className={styles.tableCol}>{city.slug}</div><div className={styles.tableCol}>{city._count.businesses}</div></div>)}</div>
    </div>
  </AdminShell>;
}
