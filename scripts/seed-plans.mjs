/**
 * Seed TX Localist database with subscription plans.
 * Run: node scripts/seed-plans.mjs
 * Production: node scripts/seed-plans.mjs --require-stripe-prices
 *
 * Feature flags are JSON strings. Each tier includes different capabilities:
 * - MAX_PHOTOS: max photo uploads
 * - SHOW_CONTACT: show phone + email
 * - SHOW_WEBSITE: show website link
 * - SHOW_SOCIALS: show social media links
 * - JOB_POSTINGS: allow job postings (1 = yes, 0 = no)
 * - FEATURED: appear in featured listings
 * - PRIORITY_SEARCH: boost in search results
 */

import "dotenv/config";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const adapter = new PrismaNeon({
  connectionString,
});

const prisma = new PrismaClient({ adapter });
const requireStripePrices = process.argv.includes("--require-stripe-prices");
const starterStripePriceId = process.env.STRIPE_PRICE_STARTER?.trim() || null;

const PLANS = [
  {
    name: "Free",
    slug: "free",
    tier: 0,
    priceCents: 0,
    billingPeriod: "monthly",
    stripePriceId: null,
    features: {
      MAX_PHOTOS: 0,
      SHOW_CONTACT: false,
      SHOW_WEBSITE: false,
      SHOW_SOCIALS: false,
      JOB_POSTINGS: 0,
      FEATURED: false,
      PRIORITY_SEARCH: false,
    },
  },
  {
    name: "Local Business Membership",
    slug: "starter",
    tier: 1,
    priceCents: 1000, // $10.00/month
    billingPeriod: "monthly",
    stripePriceId: starterStripePriceId,
    features: {
      MAX_PHOTOS: 20,
      SHOW_CONTACT: true,
      SHOW_WEBSITE: true,
      SHOW_SOCIALS: true,
      JOB_POSTINGS: 3,
      FEATURED: false,
      PRIORITY_SEARCH: false,
    },
  },
];

async function main() {
  if (requireStripePrices && !starterStripePriceId?.startsWith("price_")) {
    throw new Error(
      "STRIPE_PRICE_STARTER must be set to the $10 recurring Stripe Price before running with --require-stripe-prices.",
    );
  }

  console.log("💳 Seeding subscription plans...");

  let created = 0;
  let skipped = 0;
  const failures = [];

  for (const planData of PLANS) {
    try {
      const stripePriceUpdate =
        planData.slug === "starter" && !planData.stripePriceId
          ? {}
          : { stripePriceId: planData.stripePriceId };
      const plan = await prisma.plan.upsert({
        where: { slug: planData.slug },
        update: {
          name: planData.name,
          tier: planData.tier,
          billingPeriod: planData.billingPeriod,
          priceCents: planData.priceCents,
          ...stripePriceUpdate,
          features: JSON.stringify(planData.features),
        },
        create: {
          name: planData.name,
          slug: planData.slug,
          tier: planData.tier,
          priceCents: planData.priceCents,
          billingPeriod: planData.billingPeriod,
          stripePriceId: planData.stripePriceId,
          features: JSON.stringify(planData.features),
        },
      });

      console.log(`✓ ${plan.name} - $${(planData.priceCents / 100).toFixed(2)}/mo`);
      created++;
    } catch (error) {
      console.log(`⊘ ${planData.name} (already exists or error)`);
      console.error(error.message);
      skipped++;
      failures.push(planData.slug);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to synchronize plan rows: ${failures.join(", ")}.`);
  }

  if (requireStripePrices) {
    const starterPlan = await prisma.plan.findUnique({
      where: { slug: "starter" },
      select: {
        priceCents: true,
        billingPeriod: true,
        stripePriceId: true,
      },
    });

    if (
      starterPlan?.priceCents !== 1000 ||
      starterPlan.billingPeriod !== "monthly" ||
      starterPlan.stripePriceId !== starterStripePriceId
    ) {
      throw new Error("Starter Plan verification failed after synchronization.");
    }

    console.log(`Verified starter -> $10.00/month -> ${starterStripePriceId}`);
  }

  console.log(`\n✨ Seeded ${created} new plans, skipped ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
