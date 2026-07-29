import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import pricingStyles from "@/app/pricing/pricing.module.css";
import styles from "./PricingComparison.module.css";

const PLANS = [
  {
    slug: "free",
    name: "Free",
    price: 0,
    description: "Create a normal user account to browse businesses, events, and favorites.",
    cta: "Create Account",
    ctaHref: "/signup",
    highlight: false,
    features: [
      { label: "Business name listed", included: true },
      { label: "Appears in search results", included: true },
      { label: "City & category tags", included: true },
      { label: "Contact info visible", included: false },
      { label: "Website link", included: false },
      { label: "Social links", included: false },
      { label: "Job postings", included: false },
    ],
  },
  {
    slug: "starter",
    name: "Paid",
    price: 10,
    description: "Unlock business creation and business-linked event posting with one simple paid tier.",
    cta: "Create Account To Upgrade",
    ctaHref: "/signup?intent=owner&plan=starter",
    highlight: true,
    badge: "Best Value",
    features: [
      { label: "Business name listed", included: true },
      { label: "Appears in search results", included: true },
      { label: "City & category tags", included: true },
      { label: "Contact info visible", included: true },
      { label: "Website link", included: true },
      { label: "Social links", included: true },
      { label: "Photos", value: "20 photos", included: true },
      { label: "Job postings", value: "3 active", included: true },
    ],
  },
];

export default async function PricingComparison() {
  const user = await getCurrentUser().catch(() => null);

  return (
    <section id="pricing" className={styles.section} aria-labelledby="pricing-title">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Simple, honest pricing</p>
        <h2 id="pricing-title">Choose how you show up locally.</h2>
        <p>
          Browse for free or unlock business listings, events, and hiring tools for
          $10 a month. No contracts, cancel before your next billing date.
        </p>
      </div>

      <div className={pricingStyles.plansGrid}>
        {PLANS.map((plan) => (
          <article
            key={plan.slug}
            className={`${pricingStyles.planCard} ${
              plan.highlight ? pricingStyles.planCardHighlight : ""
            }`}
          >
            {plan.badge && <span className={pricingStyles.badge}>{plan.badge}</span>}
            <p className={pricingStyles.planName}>{plan.name}</p>
            <div className={pricingStyles.planPricing}>
              <span className={pricingStyles.planPrice}>
                ${plan.price === 0 ? "0" : plan.price.toFixed(2)}
              </span>
              <span className={pricingStyles.planPeriod}>/month</span>
            </div>
            <p className={pricingStyles.planDescription}>{plan.description}</p>

            <Link
              href={user ? "/dashboard/billing" : plan.ctaHref}
              className={`${pricingStyles.planCta} ${
                plan.highlight ? pricingStyles.planCtaHighlight : ""
              }`}
            >
              {user ? "Manage Billing" : plan.cta}
            </Link>

            <ul className={pricingStyles.featureList}>
              {plan.features.map((feature) => (
                <li
                  key={feature.label}
                  className={`${pricingStyles.featureItem} ${
                    !feature.included ? pricingStyles.featureItemMissing : ""
                  }`}
                >
                  <span className={pricingStyles.featureCheck} aria-hidden="true">
                    {feature.included ? "✓" : "×"}
                  </span>
                  <span>
                    {feature.label}
                    {feature.value ? ` — ${feature.value}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
