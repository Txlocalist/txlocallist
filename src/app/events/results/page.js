import EventsResults from "./EventsResults";
import { getEventsPageData } from "@/lib/events";

export const metadata = {
  title: "Event Results | Texas Localist",
  description: "Browse upcoming Texas events inside the Texas Localist compact calendar.",
};

export default async function EventResultsPage({ searchParams }) {
  const params = await searchParams;
  const filters = {
    query: params?.q ?? "",
    location: params?.loc ?? "",
    category: params?.category ?? "",
    date: params?.date ?? "",
  };
  const data = await getEventsPageData(filters);

  return (
    <EventsResults
      events={data.filteredEvents}
      allEvents={data.allEvents}
      cities={data.cities}
      categories={data.categories}
      initialFilters={filters}
    />
  );
}
