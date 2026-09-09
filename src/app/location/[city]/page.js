import { permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function LegacyLocationPage({ params, searchParams }) {
  const { city } = await params;
  const existingCity = await prisma.city.findUnique({
    where: { slug: city },
    select: { slug: true, name: true },
  }).catch(() => null);

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams || {})) {
    if (typeof value === "string") query.set(key, value);
  }
  if (existingCity) {
    if (query.size) {
      query.set("loc", existingCity.name);
      permanentRedirect(`/results?${query}`);
    }
    permanentRedirect(`/cities/${encodeURIComponent(existingCity.slug)}`);
  }

  const location = city
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  query.set("loc", location);
  permanentRedirect(`/search?${query}`);
}
