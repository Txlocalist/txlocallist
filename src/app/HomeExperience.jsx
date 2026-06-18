"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import BusinessCard from "@/components/BusinessCard/BusinessCard";
import Button from "@/components/Button/Button";
import CategoryPills from "@/components/CategoryPills/CategoryPills";
import SearchBar from "@/components/SearchBar/SearchBar";
import heroBackgroundArt from "@/app/assets/Tx Localist-03.png";
import styles from "./home.module.css";

const FEATURED_BUSINESSES = [
  {
    slug: "starlight-cafe-austin",
    name: "Starlight Cafe",
    city: "AUSTIN",
    description: "The best sourdough in the hill country. Family owned since 1974.",
    price: "$$",
    category: "Bakery",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA8A2GdyTWdqLn6jx-_hSITUXdNr3wORseQXb01vX21diKx9xFiAGyi9t78SHN7LRGsejMKYzNg9k6utvRci63AmGAfZkbZq71UX0gJcpgbtIV7rVYv4B2GwS2PWhMCEFlmqv-T9CXDkidJJ9fRyckmDUBcb97vf6uDBAK7BFRiDF9PjGPgZDX2VUxJUD0hu5tx8HfWMN97D5710zHV4daKtfJGXLDcQebSDfPbK_o7jVUIZTFcilrWR43Et2YLnSkOtuBwZv9vkwI",
    imageAlt: "Starlight Cafe storefront at dusk",
    badgeTone: "yellow",
  },
  {
    slug: "neon-cowboy-marfa",
    name: "Neon Cowboy",
    city: "MARFA",
    description:
      "Curated vintage Western wear and desert oddities. Truly one of a kind.",
    price: "$$$",
    category: "Retail",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBbEIBI6L9dC0ie9eU66YFIzNdrZyg083eCuDV666N6H9tAr94iR5gwTUOWmYyifRCsSopwn6rub9ymjqcFTgZ6_tlmoUguiR7rxL831CVzjMBBk6ec8bSYW_G5a00AqWmHKZTJpX6IFAOwUugfmtG6SYCiEBUWxI8gNUajUDFwMdUnKBpmGcd6TkE48IQRPY9B-CF7QzubJlb5lQsBt8ygRIECGar-DfsoO7NTJa6igIxonbvFHt1zxQl4RKa_mkf_S3Ba-lxJZuY",
    imageAlt: "Neon Cowboy vintage boutique exterior",
    badgeTone: "red",
  },
  {
    slug: "old-oak-bbq-lockhart",
    name: "Old Oak BBQ",
    city: "LOCKHART",
    description: "Central Texas style brisket smoked for 16 hours. No sauce needed.",
    price: "$",
    category: "Food",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDhb_JF5jLsjsWFF3OgR0xWgx6NxlHjg5et6OuMW3DsbsHQzGfH-p8ZwKK4MUf3t9AphDfz-dKM4ZvwBjd6F63BHyX0dkjpibA2eZhIm019AY8SnrRW1xCDmCsRRyXm4I6dtsS6JbEmsYcIHaizCKBz0Rpw6GkFXz2Ud_rUltWn6V0vCfapnJ00RJnlj2yJfVNNmKjZGaUXhvBnnGdM1ITZPu7Ajo8dIODcLA8BGOsMgASgDn58-BlebRW-ftzXmDsrsRdZpCGZgfk",
    imageAlt: "Old Oak BBQ pitmaster tending brisket",
    badgeTone: "teal",
  },
];

const FEATURED_EVENTS = [
  {
    title: "Friday Night Honky Tonk",
    tag: "Live Music",
    venue: "The White Horse",
    city: "Austin, TX",
    month: "MAY",
    day: "16",
    time: "8:00 PM",
    tone: "teal",
    photo: "music",
  },
  {
    title: "Eastside Night Market",
    tag: "Market",
    venue: "Canopy",
    city: "Austin, TX",
    month: "MAY",
    day: "17",
    time: "5:00 PM",
    tone: "red",
    photo: "market",
  },
  {
    title: "Sunset Sessions",
    tag: "Outdoor",
    venue: "Auditorium Shores",
    city: "Austin, TX",
    month: "MAY",
    day: "17",
    time: "6:00 PM",
    tone: "yellow",
    photo: "sunset",
  },
];

const FEATURES = [
  { icon: "block", label: "NO ADS", bg: "orange" },
  { icon: "volume_off", label: "NO NOISE", bg: "teal" },
  { icon: "star", label: "JUST LOCAL", bg: "yellow" },
  { icon: "thumb_up", label: "VERIFIED", bg: "red" },
];

const STEPS = [
  {
    number: 1,
    label: "PICK A VIBE",
    description: "Choose what you're in the mood for from our curated categories.",
    borderTone: "yellow",
  },
  {
    number: 2,
    label: "FIND THE SPOT",
    description: "Browse verified local favorites without any pesky advertisements.",
    borderTone: "teal",
  },
  {
    number: 3,
    label: "SUPPORT LOCAL",
    description: "Head on over and keep the Texas spirit alive and well.",
    borderTone: "red",
  },
];

const EVENT_STEPS = [
  {
    number: 1,
    label: "PICK A DATE",
    description: "Start with tonight, this weekend, or the next open day on your calendar.",
    borderTone: "teal",
  },
  {
    number: 2,
    label: "FILTER THE NOISE",
    description: "Narrow the list by city, category, venue, or the kind of night you want.",
    borderTone: "red",
  },
  {
    number: 3,
    label: "MAKE THE PLAN",
    description: "Save the event, add it to your calendar, and get back to your day.",
    borderTone: "yellow",
  },
];

const EVENT_CHIPS = [
  { label: "Live Music", icon: "music_note", query: "live music" },
  { label: "This Weekend", icon: "calendar_today", date: "this-weekend" },
  { label: "Free Events", icon: "star", query: "free" },
  { label: "Outdoor", icon: "park", query: "outdoor" },
  { label: "Markets", icon: "view_list", query: "market" },
  { label: "Family Friendly", icon: "circle", query: "family" },
  { label: "Nightlife", icon: "dark_mode", query: "nightlife" },
];

function EventSearchPanel() {
  return (
    <>
      <form className={styles.eventSearchShell} action="/events/results" method="get">
        <label className={styles.eventSearchField}>
          <span className={`material-icons ${styles.eventSearchIcon}`} aria-hidden="true">
            search
          </span>
          <input
            className={styles.eventSearchInput}
            name="q"
            type="search"
            placeholder="Search bands, venues, festivals..."
            autoComplete="off"
          />
        </label>

        <label className={styles.eventSearchField}>
          <span className={`material-icons ${styles.eventSearchIcon}`} aria-hidden="true">
            location_on
          </span>
          <input
            className={styles.eventSearchInput}
            name="loc"
            type="text"
            defaultValue="Austin, TX"
            autoComplete="off"
          />
        </label>

        <div className={styles.eventModePill}>
          <span className="material-icons" aria-hidden="true">
            event
          </span>
          Local Events
        </div>

        <label className={`${styles.eventSearchField} ${styles.eventDateField}`}>
          <span className={`material-icons ${styles.eventSearchIcon}`} aria-hidden="true">
            calendar_today
          </span>
          <select className={styles.eventDateSelect} name="date" defaultValue="this-weekend">
            <option value="this-weekend">This Weekend</option>
            <option value="tonight">Tonight</option>
            <option value="next-7-days">Next 7 Days</option>
          </select>
        </label>

        <button className={styles.eventSearchButton} type="submit">
          <span className="material-icons" aria-hidden="true">
            search
          </span>
          Search
        </button>
      </form>

      <div className={styles.eventChipRow} aria-label="Popular event filters">
        {EVENT_CHIPS.map((chip) => {
          const params = new URLSearchParams();
          if (chip.query) params.set("q", chip.query);
          if (chip.date) params.set("date", chip.date);
          return (
            <Link
              key={chip.label}
              className={styles.eventChip}
              href={`/events/results?${params.toString()}`}
            >
              <span className="material-icons" aria-hidden="true">
                {chip.icon}
              </span>
              {chip.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}

export default function HomeExperience({
  initialType = "businesses",
  visibleTypes = ["businesses", "events"],
  businessEyebrow = "TEXAS LOCAL DIRECTORY",
  businessHeadingIntro = "Find what's",
  businessAccent = "Local.",
  businessUnderline = "Fast.",
  businessTagline = "The no-nonsense directory for the Lone Star State. No ads. No tracking. Just Texas.",
}) {
  const [activeType, setActiveType] = useState(initialType);
  const isEvents = visibleTypes.includes("events") && activeType === "events";
  const currentSteps = isEvents ? EVENT_STEPS : STEPS;

  useEffect(() => {
    document.documentElement.dataset.homeMode = isEvents ? "events" : "businesses";

    return () => {
      delete document.documentElement.dataset.homeMode;
    };
  }, [isEvents]);

  return (
    <main
      id="main"
      className={`${styles.homeMain} ${isEvents ? styles.eventsMode : styles.businessMode}`}
    >
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true">
          <Image
            src={heroBackgroundArt}
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.heroBgArt}
          />
          <div className={styles.heroBgGradient}></div>
          <div className={styles.eventBackdrop}></div>
          <div className={`${styles.eventHeroArt} ${styles.eventHeroArtLeft}`}>
            <span>Live<br />Music</span>
          </div>
          <div className={`${styles.eventHeroArt} ${styles.eventHeroArtRight}`}></div>
        </div>

        <p className={styles.modeEyebrow}>
          {isEvents ? "TEXAS EVENTS CALENDAR" : businessEyebrow}
        </p>

        <h1 key={activeType} className={styles.heroHeading}>
          {isEvents ? (
            <>
              Find Texas
              <br />
              <span className={styles.eventAccent}>Events.</span>{" "}
              <span className={`material-icons ${styles.eventStar}`} aria-hidden="true">
                star
              </span>
              <br />
              Fast.
            </>
          ) : (
            <>
              {businessHeadingIntro}
              <br />
              <span className={styles.heroPrimary}>{businessAccent}</span>{" "}
              <span className={styles.heroUnderline}>{businessUnderline}</span>
            </>
          )}
        </h1>

        <p key={`${activeType}-tagline`} className={styles.heroTagline}>
          {isEvents
            ? "Live music, pop-ups, markets, and weekend plans across Texas without the noise."
            : businessTagline}
        </p>

        {isEvents ? (
          <EventSearchPanel />
        ) : (
          <>
            <SearchBar
              action="/results"
              initialType={activeType}
              visibleTypes={visibleTypes}
              autoSubmitOnTypeChange
              typeChangeHrefMap={{ events: "/events", businesses: "/businesses" }}
            />

            <CategoryPills type={activeType} />
          </>
        )}
      </section>

      <section className={styles.featuresStrip} aria-label="Why Texas Localist">
        <div className={styles.featuresContainer}>
          {FEATURES.map((feature, idx) => (
            <div key={feature.label} className={styles.featureItem}>
              <div
                className={`${styles.featureIconCircle} ${styles[`featureTone_${feature.bg}`]}`}
                data-index={idx}
              >
                <span className={`material-icons ${styles.featureIcon}`} aria-hidden="true">
                  {feature.icon}
                </span>
              </div>
              <span className={styles.featureLabel}>{feature.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.gemsSection} aria-labelledby="featured-heading">
        <div className={styles.gemsSectionHeader}>
          <h2 id="featured-heading" className={styles.gemsTitle}>
            {isEvents ? (
              <>
                Trending <br />
                <span className={styles.gemsTitleAccent}>This Weekend</span>
              </>
            ) : (
              <>
                Featured <br />
                <span className={styles.gemsTitleAccent}>Gems</span>
              </>
            )}
          </h2>
          <Link href={isEvents ? "/events/results" : "/results"} className={styles.gemsLink}>
            {isEvents ? "VIEW FULL CALENDAR" : "SEE ALL BUSINESSES"}
          </Link>
        </div>

        {isEvents ? (
          <div className={styles.eventGrid}>
            {FEATURED_EVENTS.map((event) => (
              <article key={event.title} className={styles.eventCard}>
                <div className={styles.eventTop}>
                  <div className={`${styles.dateBadge} ${styles[`dateTone_${event.tone}`]}`}>
                    <span className={styles.dateMonth}>{event.month}</span>
                    <span className={styles.dateDay}>{event.day}</span>
                    <span className={styles.dateTime}>{event.time}</span>
                  </div>
                  <div className={`${styles.eventPhoto} ${styles[`eventPhoto_${event.photo}`]}`}></div>
                </div>
                <div className={styles.eventBody}>
                  <span className={`${styles.eventTag} ${styles[`eventTag_${event.tone}`]}`}>
                    {event.tag}
                  </span>
                  <h3 className={styles.eventTitle}>{event.title}</h3>
                  <p className={styles.eventMeta}>
                    {event.venue}
                    <br />
                    {event.city}
                  </p>
                  <div className={styles.eventBottom}>
                    <span className={styles.eventMiniTag}>Local</span>
                    <span className={`material-icons ${styles.eventHeart}`} aria-hidden="true">
                      favorite_border
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.gemsGrid}>
            {FEATURED_BUSINESSES.map((business) => (
              <BusinessCard
                key={business.slug}
                business={business}
                badgeTone={business.badgeTone}
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.howItWorksSection} aria-labelledby="how-heading">
        <div className={styles.howItWorksContainer}>
          <h2 id="how-heading" className={styles.howItWorksTitle}>
            How it <span className={styles.howItWorksAccent}>Works.</span>
          </h2>

          <div className={styles.howItWorksGrid}>
            {currentSteps.map((step) => (
              <div key={step.number} className={styles.stepItem}>
                <div
                  className={`${styles.stepNumber} ${styles[`stepBorder_${step.borderTone}`]}`}
                >
                  {step.number}
                </div>
                <h3 className={styles.stepLabel}>{step.label}</h3>
                <p className={styles.stepDescription}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection} aria-labelledby="cta-heading">
        <div className={styles.ctaBg} aria-hidden="true">
          <Image
            alt=""
            fill
            className={styles.ctaBgImage}
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBRyvcjY9K8xM4cLlT8qibxFqStnZHkHvPZehIiK60agkd3qaqgqhzVsncUqeV7XCZhseo8qtgJczyAv3PZUJ4ostdVn9_1II07tsiGIExEzrwnS4M52YpDQIdAPQJRE-SmctrFIeUHtEjq5A_7CKGBYtSKgk9NtI9doaiNeJSksFXZk0G9fpxAD00yCbhaHFKTo8e-2FaTQQU1SzhUaSGFUKNy-Scuy-vA49OSHWwI3uOk7wbJhs8xyt94Y31ZY7mnPOy8COiHodU"
            sizes="100vw"
          />
        </div>
        <div className={styles.ctaContainer}>
          <h2 id="cta-heading" className={styles.ctaTitle}>
            {isEvents ? "Find the " : "Skip the "}
            <span className={styles.ctaAccent}>{isEvents ? "Night." : "Noise."}</span>
          </h2>
          <p className={styles.ctaTagline}>
            {isEvents ? "Events worth leaving the house for." : "No ads. No nonsense. Just local."}
          </p>
          <Button
            as="link"
            href={isEvents ? "/events/results" : "/results"}
            variant="cream"
            size="lg"
          >
            {isEvents ? "OPEN CALENDAR" : "START EXPLORING"}
          </Button>
        </div>
      </section>
    </main>
  );
}
