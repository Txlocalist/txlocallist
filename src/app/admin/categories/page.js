import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminCategoriesPage() {
  await requireAdmin();
  redirect("/admin/categories/business");
}
