import LandingPageTemplate from "../LandingPageTemplate";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Texas Localist | Local Businesses",
  description:
    "Find local Texas businesses without the noise. Search verified spots across the state.",
};

export default async function BusinessesPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;

  if (Object.keys(resolvedSearchParams || {}).length > 0) {
    redirect("/businesses");
  }

  return (
    <LandingPageTemplate
      initialType="businesses"
      visibleTypes={["businesses"]}
      businessHeadingIntro="Find Texas"
      businessAccent="Businesses."
      businessUnderline="Fast."
      businessTagline="Search verified local businesses across Texas. No ads. No clutter. Just the spots worth finding."
    />
  );
}
