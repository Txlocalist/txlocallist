import { redirect } from "next/navigation";

export default async function AdminEventsRedirectPage({ searchParams }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams || {})) {
    if (typeof value === "string") query.set(key, value);
  }
  query.set("type", "events");
  redirect(`/admin/posts?${query}`);
}
