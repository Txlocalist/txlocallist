import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "../AdminShell";
import CityCreateForm from "./CityCreateForm";
import CityManagementList from "./CityManagementList";
import ResultsSort from "@/components/ResultsSort/ResultsSort";
import { resultOrderBy, sortResults } from "@/lib/results-sort";
import styles from "@/app/dashboard/dashboard.module.css";

export default async function AdminCitiesPage({ searchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const cities = await prisma.city.findMany({ orderBy: resultOrderBy(params?.sort, { fallback: "name-asc" }), include: { _count: { select: { businesses: true, importedBusinesses: true } } } });
  return <AdminShell activeTab="cities">
    <div className={styles.pageHeader}><div><h1 className={styles.pageTitle}>Cities</h1><p className={styles.pageSubtitle}>Manage the cities available across TX Localist.</p></div></div>
    <div className={styles.card}><h2>Add a Texas city</h2><CityCreateForm /></div>
    <ResultsSort fallback="name-asc" />
    <CityManagementList cities={sortResults(cities, params?.sort, { fallback: "name-asc" })} />
  </AdminShell>;
}
