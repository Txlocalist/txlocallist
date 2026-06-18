import LandingPageTemplate from "./LandingPageTemplate";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Texas Localist | Find What's Nearby. Fast.",
  description:
    "The no-nonsense directory for the Lone Star State. No ads. No tracking. Just Texas.",
};

export default async function Home({ searchParams }) {
  const resolvedSearchParams = await searchParams;

  if (Object.keys(resolvedSearchParams || {}).length > 0) {
    redirect("/");
  }

  return <LandingPageTemplate />;
}
