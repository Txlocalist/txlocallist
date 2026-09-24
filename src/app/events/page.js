import EventsLanding from "./EventsLanding";
import { getCurrentUser, getDashboardPath } from "@/lib/auth/session";
import { getEventsPageData } from "@/lib/events";

// Live event data — render per-request instead of prerendering at build,
// where DATABASE_URL isn't available (see vercel build env warning).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Happenings | Texas Localist",
  description: "Discover Texas happenings through the Texas Localist calendar.",
};

export default async function EventsPage() {
  const user = await getCurrentUser().catch(() => null);
  const { allEvents, cities, categories } = await getEventsPageData(
    {},
    { userId: user?.id }
  );

  return (
    <EventsLanding
      events={allEvents}
      cities={cities}
      categories={categories}
      isLoggedIn={Boolean(user)}
      dashboardPath={user ? getDashboardPath(user.role) : "/dashboard"}
    />
  );
}
