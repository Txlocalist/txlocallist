import { redirect } from "next/navigation";

export default async function AdminEventsRedirectPage() {
  redirect("/admin/posts?type=events");
}
