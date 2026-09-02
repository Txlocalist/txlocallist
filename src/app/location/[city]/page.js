import { permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function LegacyLocationPage({ params }) {
  const { city } = await params;
  const existingCity = await prisma.city.findUnique({
    where: { slug: city },
    select: { slug: true },
  }).catch(() => null);

  if (existingCity) permanentRedirect(`/cities/${encodeURIComponent(existingCity.slug)}`);

  const location = city
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  permanentRedirect(`/search?loc=${encodeURIComponent(location)}`);
}
