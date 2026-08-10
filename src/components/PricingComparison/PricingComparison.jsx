import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import {
  EVENT_MAX_CALENDAR_DAYS,
  EVENT_POST_CHECKOUT_DISCLOSURE,
  PRICING_OFFERS,
  formatWholeDollarPrice,
  isEventPostingEnabled,
} from "@/lib/pricing";
import pricingStyles from "@/app/pricing/pricing.module.css";
import styles from "./PricingComparison.module.css";

const MEMBERSHIP_PRICE = formatWholeDollarPrice(PRICING_OFFERS.membership.priceCents);
const EVENT_POST_PRICE = formatWholeDollarPrice(PRICING_OFFERS.eventPost.priceCents);

const PLANS = [
  {
    slug: "free",
    name: "Free Account",
    price: formatWholeDollarPrice(PRICING_OFFERS.free.priceCents),
    period: "forever",
    description: "Browse Texas businesses and events, then save the places you want to revisit.",
    signedOutCta: "Create Account",
    signedOutHref: "/signup",
    signedInCta: "Browse Local",
    signedInHref: "/results",
    features: [
      { label: "Search by city and keyword", preview: true },
      { label: "Browse business and event pages", preview: true },
      { label: "Save favorite businesses", preview: true },
    ],
    finePrint: "Browsing and saving only. Business and event publishing are not included.",
  },
  {
    slug: "membership",
    name: PRICING_OFFERS.membership.name,
    price: MEMBERSHIP_PRICE,
    period: PRICING_OFFERS.membership.billingLabel,
    description: "Publish a complete business profile and use the owner tools that help locals find you.",
    signedOutCta: "Start Membership",
    signedOutHref: "/signup?intent=owner&plan=starter",
    signedInCta: "Manage Membership",
    signedInHref: "/dashboard/billing",
    highlight: true,
    badge: "For Local Businesses",
    features: [
      { label: "Create and manage your business profile", preview: true },
      { label: "Show contact details, website, and social links", preview: true },
      { label: "Add up to 20 listing photos" },
      { label: "Publish up to 3 active job posts" },
      { label: "Submit business-linked events for review", preview: true },
    ],
    finePrint:
      "No contract. Renews monthly on your signup anniversary. Cancel before your next renewal date.",
  },
  {
    slug: "event",
    name: PRICING_OFFERS.eventPost.name,
    price: EVENT_POST_PRICE,
    period: PRICING_OFFERS.eventPost.billingLabel,
    description: "Put one event on the community calendar without starting a business membership.",
    signedOutCta: "Post an Event",
    signedOutHref: "/post-an-event",
    signedInCta: "Post an Event",
    signedInHref: "/post-an-event",
    features: [
      {
        label: `One event lasting 1-${EVENT_MAX_CALENDAR_DAYS} consecutive days`,
        preview: true,
      },
      { label: "The same price for a one-day or multi-day event", preview: true },
      { label: "Admin review before publication", preview: true },
      { label: "Optional event or ticket link" },
      { label: "No business membership required", preview: true },
    ],
    finePrint: EVENT_POST_CHECKOUT_DISCLOSURE,
  },
];

function planCardClass(plan) {
  const classes = [pricingStyles.planCard];

  if (plan.highlight) classes.push(pricingStyles.planCardHighlight);
  if (plan.slug === "free") classes.push(pricingStyles.planCardFree);
  if (plan.slug === "membership") classes.push(pricingStyles.planCardMembership);
  if (plan.slug === "event") classes.push(pricingStyles.planCardEvent);

  return classes.join(" ");
}

export default async function PricingComparison({ compact = false }) {
  const user = await getCurrentUser().catch(() => null);
  const eventPostingEnabled = isEventPostingEnabled();

  return (
    <section
      id="pricing"
      className={`${styles.section} ${compact ? styles.sectionCompact : ""}`}
      aria-labelledby="pricing-title"
    >
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Simple, honest pricing</p>
        <h2 id="pricing-title">Choose how you show up locally.</h2>
        <p>
          Browse and save for free. Memberships are {MEMBERSHIP_PRICE} monthly, and one event
          post is {EVENT_POST_PRICE}.
        </p>
      </div>

      <div className={pricingStyles.plansGrid}>
        {PLANS.map((plan) => {
          const features = compact
            ? plan.features.filter((feature) => feature.preview)
            : plan.features;
          const ctaHref = user ? plan.signedInHref : plan.signedOutHref;
          const ctaLabel = user ? plan.signedInCta : plan.signedOutCta;
          const eventUnavailable = plan.slug === "event" && !eventPostingEnabled;

          return (
            <article key={plan.slug} className={planCardClass(plan)}>
              {plan.badge ? <span className={pricingStyles.badge}>{plan.badge}</span> : null}

              <div className={pricingStyles.planSummary}>
                <h3 className={pricingStyles.planName}>{plan.name}</h3>
                <div className={pricingStyles.planPricing}>
                  <span className={pricingStyles.planPrice}>{plan.price}</span>
                  <span className={pricingStyles.planPeriod}>{plan.period}</span>
                </div>
                <p className={pricingStyles.planDescription}>{plan.description}</p>

                {eventUnavailable ? (
                  <span className={pricingStyles.planCta} aria-disabled="true">
                    Checkout Opening Soon
                  </span>
                ) : (
                  <Link
                    href={ctaHref}
                    className={`${pricingStyles.planCta} ${
                      plan.highlight ? pricingStyles.planCtaHighlight : ""
                    }`}
                  >
                    {ctaLabel}
                  </Link>
                )}
              </div>

              <div className={pricingStyles.planDetails}>
                <ul className={pricingStyles.featureList}>
                  {features.map((feature) => (
                    <li key={feature.label} className={pricingStyles.featureItem}>
                      <span className={pricingStyles.featureCheck} aria-hidden="true">
                        ✓
                      </span>
                      <span>{feature.label}</span>
                    </li>
                  ))}
                </ul>

                <p className={pricingStyles.planFinePrint}>{plan.finePrint}</p>
              </div>
            </article>
          );
        })}
      </div>

      {compact ? (
        <div className={styles.detailsLinkWrap}>
          <Link href="/pricing" className={styles.detailsLink}>
            View Full Pricing Details
          </Link>
        </div>
      ) : null}
    </section>
  );
}
