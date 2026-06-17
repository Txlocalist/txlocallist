import { redirect } from "next/navigation";

export default async function AdminBusinessesRedirectPage() {
  redirect("/admin/posts?type=businesses");
}
