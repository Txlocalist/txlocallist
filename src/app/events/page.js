import EventsLanding from "./EventsLanding";
import { getEventsPageData } from "@/lib/events";

export const metadata = {
  title: "Events | Texas Localist",
  description: "Discover Texas events through the Texas Localist events landing page.",
};

export default async function EventsPage() {
  const { allEvents, cities, categories } = await getEventsPageData();

  return <EventsLanding events={allEvents} cities={cities} categories={categories} />;
}
