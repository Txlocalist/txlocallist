/**
 * Seeds the "Testing Italian" listing with full test data so all
 * business detail page features are visible and testable.
 *
 * Run: node scripts/seed-italian-test.mjs
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// ─── Free Unsplash food photos (no API key needed) ───────────────────────────
const PHOTOS = [
  {
    url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
    alt: "Restaurant interior with warm lighting",
    order: 0,
  },
  {
    url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    alt: "Pasta dish beautifully plated",
    order: 1,
  },
  {
    url: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
    alt: "Wood-fired pizza fresh from the oven",
    order: 2,
  },
  {
    url: "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?w=800&q=80",
    alt: "Tiramisu dessert close-up",
    order: 3,
  },
  {
    url: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80",
    alt: "Wine glasses and antipasto spread",
    order: 4,
  },
];

async function main() {
  // ── 1. Find the Italian business ──────────────────────────────────────────
  const biz = await prisma.business.findFirst({
    where: { name: { contains: "italian", mode: "insensitive" } },
    include: { plan: true, city: true },
  });

  if (!biz) {
    console.error("❌  Could not find a business with 'italian' in the name.");
    process.exit(1);
  }
  console.log(`✅  Found: "${biz.name}" (id: ${biz.id}) — city: ${biz.city?.name}`);

  // ── 2. Find the paid plan ────────────────────────────────────────────────
  const paidPlan = await prisma.plan.findUnique({ where: { slug: "starter" } });
  if (!paidPlan) {
    console.error("❌  Could not find the paid plan — run seed-plans.mjs first.");
    process.exit(1);
  }
  console.log(`✅  Using plan: ${paidPlan.slug} (tier ${paidPlan.tier})`);

  // ── 3. Update core business fields ────────────────────────────────────────
  await prisma.business.update({
    where: { id: biz.id },
    data: {
      name:        "Trattoria Della Nonna",
      slug:        "trattoria-della-nonna",
      description:
        "Three generations deep and still going strong. Since 1987, Nonna Rosa's recipes have anchored this corner of Austin's East Side — hand-rolled pastas, wood-fired Neapolitan pizzas, and a wine list that reads like a love letter to the Italian countryside. No shortcuts, no chains. Just family, fire, and flour.",
      address:     "1203 E 6th St",
      phone:       "(512) 555-0197",
      email:       "ciao@trattorianonna.com",
      website:     "https://trattorianonna.com",
      status:      "ACTIVE",
      publishedAt: new Date(),
      planId:      paidPlan.id,
    },
  });
  console.log("✅  Updated business fields");

  // ── 4. Replace photos ──────────────────────────────────────────────────────
  await prisma.photo.deleteMany({ where: { businessId: biz.id } });
  await prisma.photo.createMany({
    data: PHOTOS.map((p) => ({ ...p, businessId: biz.id })),
  });
  console.log(`✅  Added ${PHOTOS.length} photos`);

  // ── 5. Replace social links ────────────────────────────────────────────────
  await prisma.socialLink.deleteMany({ where: { businessId: biz.id } });
  await prisma.socialLink.createMany({
    data: [
      { businessId: biz.id, platform: "instagram", url: "https://instagram.com/trattorianonna", order: 0 },
      { businessId: biz.id, platform: "facebook",  url: "https://facebook.com/trattorianonna",  order: 1 },
      { businessId: biz.id, platform: "twitter",   url: "https://twitter.com/trattorianonna",   order: 2 },
    ],
  });
  console.log("✅  Added social links");

  // ── 6. Add a category if needed ────────────────────────────────────────────
  let italianCat = await prisma.category.findFirst({
    where: { name: { contains: "italian", mode: "insensitive" } },
  });
  if (!italianCat) {
    italianCat = await prisma.category.findFirst({
      where: { name: { contains: "restaurant", mode: "insensitive" } },
    });
  }
  if (italianCat) {
    const existing = await prisma.businessCategory.findFirst({
      where: { businessId: biz.id, categoryId: italianCat.id },
    });
    if (!existing) {
      await prisma.businessCategory.create({
        data: { businessId: biz.id, categoryId: italianCat.id },
      });
      console.log(`✅  Linked category: ${italianCat.name}`);
    } else {
      console.log(`ℹ️   Category already linked: ${italianCat.name}`);
    }
  } else {
    console.log("ℹ️   No matching category found — skipping");
  }

  // ── 7. Add tags ────────────────────────────────────────────────────────────
  const tagNames = ["pasta", "pizza", "italian", "date-night", "wood-fired"];
  for (const name of tagNames) {
    let tag = await prisma.tag.findFirst({ where: { name } });
    if (!tag) {
      tag = await prisma.tag.create({ data: { name, slug: name } });
    }
    const existing = await prisma.businessTag.findFirst({
      where: { businessId: biz.id, tagId: tag.id },
    });
    if (!existing) {
      await prisma.businessTag.create({
        data: { businessId: biz.id, tagId: tag.id },
      });
    }
  }
  console.log("✅  Added tags: " + tagNames.join(", "));

  // ── 8. Add a test job ─────────────────────────────────────────────────────
  const existingJob = await prisma.job.findFirst({ where: { businessId: biz.id } });
  if (!existingJob) {
    await prisma.job.create({
      data: {
        businessId:     biz.id,
        title:          "Line Cook",
        description:    "Passionate about Italian cuisine? Join our kitchen team. Experience with fresh pasta preferred.",
        employmentType: "FULL_TIME",
        salaryMin:      4000_00, // $4,000/mo in cents
        salaryMax:      5500_00,
        status:         "ACTIVE",
      },
    });
    console.log("✅  Added test job posting");
  } else {
    console.log("ℹ️   Job already exists — skipping");
  }

  console.log("\n🎉  Done! Visit: http://localhost:3000/business/trattoria-della-nonna");
}

main().catch(console.error).finally(() => prisma.$disconnect());
