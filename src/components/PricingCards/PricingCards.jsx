import Link from "next/link";

import {
  EVENT_MAX_CALENDAR_DAYS,
  EVENT_POST_PRICE_CENTS,
  MEMBERSHIP_PRICE_CENTS,
  formatWholeDollarPrice,
} from "@/lib/pricing";

import styles from "@/app/pricing/pricing.module.css";

const membershipPrice = formatWholeDollarPrice(MEMBERSHIP_PRICE_CENTS);
const eventPostPrice = formatWholeDollarPrice(EVENT_POST_PRICE_CENTS);

const plans = [
  {
    name: "Localist",
    price: "$0",
    cadence: "forever",
    description: "Explore the Texas local list, like businesses and events, and save your favorites.",
    features: ["Search businesses and events", "Like and save favorites", "Create a free account"],
    cta: "Explore Local",
    href: "/results",
  },
  {
    name: "Local Business Membership",
    price: membershipPrice,
    cadence: "per month",
    description: "Build a complete business profile and get discovered by people nearby.",
    features: ["Publish your business listing", "Add contact details, photos, and links", "Manage your profile month to month"],
    cta: "List Your Business",
    href: "/post-your-business",
    featured: true,
  },
  {
    name: "Event Calendar Post",
    price: eventPostPrice,
    cadence: "one time",
    description: "Submit one event for the community calendar. Every event is reviewed before publication.",
    features: [
      `One event lasting up to ${EVENT_MAX_CALENDAR_DAYS} consecutive days`,
      "An optional ticket or event link",
      "Review before it appears publicly",
    ],
    cta: "Post an Event",
    href: "/dashboard/events/new",
  },
];

export default function PricingCards() {
  return (
    <div className={styles.plans}>
      {plans.map((plan) => (
        <article
          key={plan.name}
          className={`${styles.plan} ${plan.featured ? styles.planFeatured : ""}`}
        >
          {plan.featured ? <span className={styles.badge}>For Local Businesses</span> : null}
          <h2>{plan.name}</h2>
          <p className={styles.price}>
            {plan.price} <span>{plan.cadence}</span>
          </p>
          <p className={styles.description}>{plan.description}</p>
          <ul>
            {plan.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <Link href={plan.href} className={styles.cta}>
            {plan.cta}
          </Link>
        </article>
      ))}
    </div>
  );
}
