import BusinessContactActions from "@/app/business/[slug]/BusinessContactActions";
import HiringBadge from "@/app/business/[slug]/HiringBadge";
import PhotoGallery from "@/app/business/[slug]/PhotoGallery";
import danceHall from "@/app/assets/texas-dance-hall.webp";
import store from "@/app/assets/hero-how-it-works.webp";
import landscape from "@/app/assets/vintage Texas landscape.png";
import BusinessDetails from "@/app/business/[slug]/BusinessDetails";
import businessStyles from "@/app/business/[slug]/page.module.css";
import EventSkeleton from "@/app/events/EventSkeleton";
import { CreateEventForm } from "@/app/dashboard/events/new/CreateEventForm";
import { getBusinessHoursDisplayRows } from "@/lib/business-hours";
import { OverviewContent } from "@/app/dashboard/OverviewContent";
import HappeningActions from "@/app/dashboard/events/HappeningActions";
import dashboardStyles from "@/app/dashboard/dashboard.module.css";
import eventStyles from "@/app/dashboard/events/events.module.css";

export default function ListingUpdatesFixture({ path, params }) {
  if (path.endsWith("event-actions")) return (
    <main style={{ maxWidth: 1100, padding: 24, margin: "auto" }}>
      <h1>My Happenings</h1>
      <div className={dashboardStyles.businessesTable}>
        <div className={`${dashboardStyles.tableHeader} ${eventStyles.eventRow}`}>
          {["Title", "City", "Date", "Status", "Actions"].map((label) => <div key={label}>{label}</div>)}
        </div>
        {["City of Round Rock First Responders Day", "Steven Everett plays at Urban Rooftop", "Forest Creek HOA neighborhood yard sale"].map((title, index) => (
          <div className={`${dashboardStyles.tableRow} ${eventStyles.eventRow}`} key={title}>
            <div className={dashboardStyles.tableCol} data-label="Title"><strong>{title}</strong></div>
            <div className={dashboardStyles.tableCol} data-label="City">Round Rock, TX</div>
            <div className={dashboardStyles.tableCol} data-label="Date">May 24, 2026</div>
            <div className={dashboardStyles.tableCol} data-label="Status"><span className={dashboardStyles.statusACTIVE}>PUBLISHED</span></div>
            <div className={dashboardStyles.tableCol} data-label="Actions">
              <HappeningActions event={{ id: `event-${index}`, title, status: "PUBLISHED", postingMethod: "LEGACY" }} hasCreatorAccess />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
  if (path.endsWith("dashboard")) return (
    <main style={{ maxWidth: 1050, margin: "auto", padding: 24 }}>
      <OverviewContent
        canCreateListing
        greetingName="Neighbor"
        stats={{ total: 0, active: 0, paidPlans: 0, draft: 0 }}
        recentBusinesses={[]}
        recentEvents={[{
          id: "market", title: "Saturday Market: Food, Music & Local Makers Around the Town Square",
          city: "Austin", status: "PUBLISHED", postingMethod: "SUBSCRIPTION", recurrence: "NONE",
          startDate: params.has("past") ? "2000-05-24T15:00:00Z" : "2099-01-10T16:00:00Z", endDate: params.has("past") ? "2000-05-24T17:00:00Z" : "2099-01-10T18:00:00Z", timezone: "America/Chicago",
        }]}
      />
    </main>
  );
  if (path.includes("loader"))
    return <EventSkeleton variant={params.get("variant") || "landing"} />;
  if (path.endsWith("event-edit"))
    return (
      <main style={{ maxWidth: 850, margin: "auto", padding: 24 }}>
        <CreateEventForm
          mode="edit"
          hasMembership
          businesses={[{ id: "shop", name: "Town Market" }]}
          cities={[{ id: "austin", name: "Austin" }]}
          categories={[{ id: "community", name: "Community" }]}
          initialEvent={{
            id: "event",
            title: "Community Market",
            description: "A neighborhood market with food and live music.",
            status: "PUBLISHED",
            postingMethod: "SUBSCRIPTION",
            imageUrl: params.has("external") ? "https://www.roundrockfirefighters.org/round-rock-safety" : "/fixtures/original.png",
            categoryIds: ["community"],
            address: "123 Main Street",
            city: "Austin",
            zipCode: "78701",
            businessId: "shop",
            timezone: "America/Chicago",
            startDate: params.has("past") ? "2000-05-24T10:00" : "2099-01-10T10:00",
            endDate: params.has("past") ? "2000-05-24T12:00" : "2099-01-10T12:00",
          }}
        />
      </main>
    );
  const sentence =
    "A neighborhood shop with local goods, friendly faces, and something new to discover. ";
  const business = {
    name: "Town Market",
    description: params.has("long")
      ? sentence.repeat(17)
      : params.has("unbroken")
        ? "Local".repeat(150)
        : sentence,
    isHiring: !params.has("noHiring"),
    address: params.has("noAddress") ? "" : "3490 Sandmound Blvd",
    city: { name: "Houston" },
    categories: [
      { category: { id: "market", name: "Market", slug: "market" } },
    ],
    tags: [{ tag: { id: "family", name: "Family Owned" } }],
    socialLinks: [],
  };
  return (
    <main className={businessStyles.pageWrapper} style={{ paddingTop: 1 }}>
      <title>Town Market | TX Localist preview</title>
      {path.endsWith("business-polish") ? (
        <section className={businessStyles.heroSection}>
          <div className={businessStyles.heroImageWrap}>
            <img
              src={danceHall}
              alt="Texas dance hall"
              className={businessStyles.heroImg}
            />
            <div className={businessStyles.heroOverlay}>
              <div className={businessStyles.heroTop}>
                <span className={businessStyles.badgeCity}>Houston, Texas</span>
                {business.isHiring ? <HiringBadge /> : null}
              </div>
              <div className={businessStyles.heroBottom}>
                <h1 className={businessStyles.heroTitle}>{business.name}</h1>
              </div>
            </div>
          </div>
          <BusinessContactActions
            businessName={business.name}
            phone={params.has("noPhone") ? null : "(713) 555-0186"}
            website={
              params.has("noWebsite") ? null : "https://townmarket.example.com"
            }
          />
        </section>
      ) : null}
      <BusinessDetails
        business={business}
        showContact
        showSocials
        hoursRows={getBusinessHoursDisplayRows([])}
        hiringRoles={["Cashier"]}
        hiringApplyHref="/apply"
        mapsUrl="https://maps.google.com"
      />
      {path.endsWith("business-polish") ? (
        <section
          className={businessStyles.gallerySection}
          aria-label="Business photos"
        >
          <PhotoGallery
            businessName={business.name}
            photos={[
              { id: "hall", url: danceHall, alt: "Texas dance hall at sunset" },
              { id: "store", url: store, alt: "A Texas storefront" },
              { id: "landscape", url: landscape, alt: "Texas countryside" },
            ].slice(0, Number(params.get("photos") ?? 3))}
          />
        </section>
      ) : null}
    </main>
  );
}
