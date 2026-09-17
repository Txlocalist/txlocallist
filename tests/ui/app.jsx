import { createRoot } from "react-dom/client";
import { usePathname, useSearchParams } from "next/navigation";
import DeleteListingButton from "@/components/DeleteListingButton/DeleteListingButton";
import ResultsExperience from "@/app/results/ResultsExperience";
import DashboardFrame from "@/app/dashboard/DashboardFrame";
import dashboardStyles from "@/app/dashboard/DashboardShell.module.css";
import Link from "next/link";
import EventsLanding from "@/app/events/EventsLanding";
import EventsResults from "@/app/events/results/EventsResults";
import { CreateEventForm } from "@/app/dashboard/events/new/CreateEventForm";
import { FavoritesDashboard } from "@/app/dashboard/favorites/FavoritesDashboard";
import CityCreateForm from "@/app/admin/cities/CityCreateForm";
import { CreateBusinessForm } from "@/app/dashboard/businesses/new/CreateBusinessForm";
import { EditBusinessForm } from "@/app/dashboard/businesses/[id]/edit/EditBusinessForm";
import "@/app/globals.css";
import "@/app/results/globals.css";
const names = ["zebra", "Alpha", "beta", "alpha", "Delta", "Echo"];
const favorites = names.map((name, index) => ({ id: String(index), businessId: String(index), businessSlug: name, name, createdAt: `2026-01-0${index+1}`, cityName: index % 2 ? "Austin" : "Dallas", description: "Friendly neighborhood shop with handmade goods.", categories: [], planName: "Starter" }));
const events = names.map((title, index) => ({ id: String(index), title, description: "A community gathering with food and music.", createdAt: `2026-01-0${index+1}`, startDate: `2030-01-${10+index}T16:00:00Z`, dateKey: `2030-01-${10+index}`, dateKeys: [`2030-01-${10+index}`], shortDateRangeLabel: `Jan ${10+index}`, timeLabel: "10:00 AM", startHour: 10, city: "Austin", state: "TX", cityLabel: "Austin, TX", venue: "Town Hall", categoryTags: [{ name: "Community" }], tags: [], type: "Community" }));
function App() {
  const path = usePathname(); const params = useSearchParams();
  const calendarEvents = localStorage.getItem("fixtureRecurring") ? [{
    ...events[0], title: "Weekly Open Mic", recurrence: "WEEKLY", recurrenceLabel: "Every Thursday", timezone: "America/Chicago",
    endDate: "2030-01-10T18:00:00Z", dateKeys: ["2030-01-10", "2030-01-17", "2030-01-24"],
    occurrences: ["10", "17", "24"].map((day) => ({ startDate: `2030-01-${day}T16:00:00Z`, endDate: `2030-01-${day}T18:00:00Z`, dateKeys: [`2030-01-${day}`] })),
  }] : events;
  const cities = ["Austin", "Dallas", localStorage.getItem("fixtureCity") || "Empty Town"];
  const resultEvents = localStorage.getItem("fixturePagedEvents")
    ? Array.from({ length: 25 }, (_, index) => ({ ...calendarEvents[index % calendarEvents.length], id: String(index), title: `Event ${String(index).padStart(2, "0")}` }))
    : calendarEvents;
  if (path === "/dashboard-shell") {
    const admin = params.has("admin");
    return <DashboardFrame
      title={admin ? "Admin Overview" : "Dashboard"}
      menuLabel={admin ? "Admin navigation" : "Dashboard navigation"}
      navigation={<aside className={dashboardStyles.sidebar}>
        <Link href={admin ? "/dashboard-shell" : "/dashboard-shell?admin=1"} className={dashboardStyles.sidebarCta}>{admin ? "User Dashboard" : "Admin Dashboard"}</Link>
        <nav className={dashboardStyles.sidebarNav}>
          <Link href="/dashboard-shell" className={dashboardStyles.navLink}>Overview</Link>
          {admin ? ["Posts", "Users", "Tags", "Cities", "Admin Tools"].map((label) => <Link key={label} href="/dashboard-shell?admin=1" className={dashboardStyles.navLink}>{label}</Link>) : ["Posts", "Businesses", "Account"].map((label) => <details open key={label} className={dashboardStyles.navSection}><summary className={dashboardStyles.navSectionSummary}>{label}</summary><div className={dashboardStyles.navSectionItems}>{["View", "Create", "Saved"].map((action) => <Link key={action} href="/dashboard-shell" className={dashboardStyles.navLink}>{action} {label}</Link>)}</div></details>)}
        </nav>
      </aside>}
      account={<div className={dashboardStyles.topbarActions}><div className={dashboardStyles.profilePill}><span className={dashboardStyles.profileAvatar}>T</span><div className={dashboardStyles.profileText}><span className={dashboardStyles.profileEmail}>localist@example.com</span><span className={dashboardStyles.profileRole}>{admin ? "ADMIN" : "USER"}</span></div></div><button type="button" className={dashboardStyles.logoutButton}>Log out</button></div>}
    ><h1>{admin ? "Admin Overview" : "Your local hub"}</h1><p>Your dashboard content starts here.</p><button type="button">Page action</button></DashboardFrame>;
  }
  if (path === "/event-form" || path === "/event-form-edit") return <main style={{ maxWidth: 850, margin: "auto", padding: 24 }}><CreateEventForm
    businesses={[{ id: "fixture-business", name: "Town Hall" }]} hasMembership={!params.has("oneTime")} oneTimePostingEnabled eventPostPrice="$10"
    mode={path.endsWith("edit") ? "edit" : "create"}
    initialEvent={{ title: "Weekly Open Mic", description: "Join your neighbors for live music every Thursday night.", category: "Live Music", address: "123 Main Street", city: "Austin", zipCode: "78701", businessId: "fixture-business", startDate: "2030-01-10T19:00", endDate: "2030-01-10T22:00", timezone: "America/Chicago", ...(path.endsWith("edit") ? { id: "fixture-event", postingMethod: params.has("oneTime") ? "ONE_TIME" : "SUBSCRIPTION", recurrence: params.has("oneTime") ? "NONE" : "WEEKLY", recurrenceUntil: "2030-02-07" } : {}) }}
  /></main>;
  if (path === "/results") return <ResultsExperience availableCities={cities} availableCategories={[{ id: "shops", name: "Shops", slug: "shops" }]} initialFavoriteBusinesses={favorites.map((item) => ({ ...item, savedAt: item.createdAt, slug: item.businessSlug, city: { name: item.cityName }, activeJobCount: 1 }))} user={{ id: "fixture" }} dashboardPath="/dashboard" />;
  if (path === "/events") return <EventsLanding events={calendarEvents} cities={cities.map((city) => `${city}, TX`)} categories={["Community", "Live Music", "Markets"]} isLoggedIn dashboardPath="/dashboard" />;
  if (path === "/events/results") return <EventsResults events={resultEvents} allEvents={resultEvents} cities={cities.map((city) => `${city}, TX`)} categories={["Community"]} isLoggedIn dashboardPath="/dashboard" />;
  if (path === "/saved") return <main style={{ padding: 20 }}><FavoritesDashboard favorites={favorites} /></main>;
  if (path === "/city") return <main style={{ maxWidth: 720, padding: 24, margin: "auto" }}><h1>Add a Texas city</h1><CityCreateForm /></main>;
  if (path === "/new-business") return <main style={{ maxWidth: 900, padding: 20, margin: "auto" }}><CreateBusinessForm cities={cities.map((name) => ({ id: name, name }))} categories={[]} tags={[]} /></main>;
  if (path === "/edit-business") return <main style={{ maxWidth: 900, padding: 20, margin: "auto" }}><EditBusinessForm business={{ id: "fixture", name: "Town Market", description: "A local market serving the community.", cityId: "Austin", categories: [], tags: [] }} cities={cities.map((name) => ({ id: name, name }))} categories={[]} tags={[]} /></main>;
  return <main style={{ maxWidth: 800, margin: "auto", padding: 24 }}><h1>My listings</h1><p>Town Market</p><DeleteListingButton id="fixture" name="Town Market" kind={params.get("kind") || "business"} /><button style={{ margin: 20 }}>Outside dialog</button></main>;
}
createRoot(document.getElementById("root")).render(<App />);
