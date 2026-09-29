import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { CATEGORY_TYPES } from "@/lib/categories";
import { AdminShell } from "../../AdminShell";
import CategoryManager from "../CategoryManager";
import styles from "@/app/dashboard/dashboard.module.css";

export default async function AdminCategoriesPage({ params }) {
  await requireAdmin();
  const { type } = await params;
  const config = Object.hasOwn(CATEGORY_TYPES, type) ? CATEGORY_TYPES[type] : null;
  if (!config) notFound();
  const categories = await prisma[config.model].findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { [config.relation]: true } } },
  });
  return <AdminShell activeTab={`${type}-categories`}>
    <div className={styles.pageHeader}><div>
      <h1 className={styles.pageTitle}>{config.title}</h1>
      <p className={styles.pageSubtitle}>Manage categories for {type === "business" ? "business listings" : "events"}. Business and event categories have separate lists.</p>
    </div></div>
    <CategoryManager type={type} categories={categories.map((category) => ({ id: category.id, name: category.name, count: category._count[config.relation] }))} />
  </AdminShell>;
}
