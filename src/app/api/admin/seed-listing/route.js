/**
 * DEV-ONLY seed endpoint.
 * Opens in browser: http://localhost:3000/api/admin/seed-listing
 *
 * Finds any business with "italian" in the name (or the first business
 * if none found), upgrades it to the paid plan, and populates it with
 * full test data so every feature on the business listing page is visible.
 *
 * Redirects to the business page on success.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PHOTOS = [
  {
    url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
    alt: "Restaurant interior warm lighting",
    order: 0,
  },
  {
    url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80",
    alt: "Fresh pasta beautifully plated",
    order: 1,
  },
  {
    url: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=900&q=80",
    alt: "Wood-fired Neapolitan pizza",
    order: 2,
  },
  {
    url: "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?w=900&q=80",
    alt: "Tiramisu dessert close-up",
    order: 3,
  },
  {
    url: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=900&q=80",
    alt: "Wine and antipasto spread",
    order: 4,
  },
];

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    // ── 1. Find a business to seed ─────────────────────────────────────────
    let biz = await prisma.business.findFirst({
      where: { name: { contains: "italian", mode: "insensitive" } },
      include: { city: true },
    });

    // Fallback: grab any business
    if (!biz) {
      biz = await prisma.business.findFirst({ include: { city: true } });
    }

    if (!biz) {
      return NextResponse.json({ error: "No businesses found in the database at all." }, { status: 404 });
    }

    // ── 2. Get paid plan ───────────────────────────────────────────────────
    const paidPlan = await prisma.plan.findUnique({ where: { slug: "starter" } });
    if (!paidPlan) {
      return NextResponse.json({ error: "Paid plan not found — run: npm run db:seed-plans" }, { status: 500 });
    }

    // ── 3. Build new slug (keep stable) ───────────────────────────────────
    const newSlug = "trattoria-della-nonna";

    // Check if slug is already taken by a DIFFERENT business
    const slugTaken = await prisma.business.findFirst({
      where: { slug: newSlug, NOT: { id: biz.id } },
    });
    const useSlug = slugTaken ? biz.slug : newSlug;

    // ── 4. Update business fields ──────────────────────────────────────────
    const updated = await prisma.business.update({
      where: { id: biz.id },
      data: {
        name:        "Trattoria Della Nonna",
        slug:        useSlug,
        description: "Three generations deep and still going strong. Since 1987, Nonna Rosa's recipes have anchored this corner of Austin's East Side — hand-rolled pastas, wood-fired Neapolitan pizzas, and a wine list that reads like a love letter to the Italian countryside. No shortcuts, no chains. Just family, fire, and flour.",
        address:     "1203 E 6th St",
        phone:       "(512) 555-0197",
        email:       "ciao@trattorianonna.com",
        website:     "https://trattorianonna.com",
        status:      "ACTIVE",
        publishedAt: new Date(),
        planId:      paidPlan.id,
      },
    });

    // ── 5. Replace photos ─────────────────────────────────────────────────
    await prisma.photo.deleteMany({ where: { businessId: biz.id } });
    await prisma.photo.createMany({
      data: PHOTOS.map((p) => ({ ...p, businessId: biz.id })),
    });

    // ── 6. Replace social links ───────────────────────────────────────────
    await prisma.socialLink.deleteMany({ where: { businessId: biz.id } });
    await prisma.socialLink.createMany({
      data: [
        { businessId: biz.id, platform: "instagram", url: "https://instagram.com/trattorianonna", order: 0 },
        { businessId: biz.id, platform: "facebook",  url: "https://facebook.com/trattorianonna",  order: 1 },
        { businessId: biz.id, platform: "twitter",   url: "https://twitter.com/trattorianonna",   order: 2 },
      ],
    });

    // ── 7. Tags ───────────────────────────────────────────────────────────
    const tagNames = ["pasta", "pizza", "italian", "date-night", "wood-fired"];
    for (const name of tagNames) {
      let tag = await prisma.tag.findFirst({ where: { name } });
      if (!tag) {
        tag = await prisma.tag.create({ data: { name, slug: name } });
      }
      const exists = await prisma.businessTag.findFirst({
        where: { businessId: biz.id, tagId: tag.id },
      });
      if (!exists) {
        await prisma.businessTag.create({ data: { businessId: biz.id, tagId: tag.id } });
      }
    }

    // ── 8. Category ───────────────────────────────────────────────────────
    let cat = await prisma.category.findFirst({
      where: { name: { contains: "italian", mode: "insensitive" } },
    });
    if (!cat) {
      cat = await prisma.category.findFirst({
        where: { name: { contains: "restaurant", mode: "insensitive" } },
      });
    }
    if (!cat) {
      cat = await prisma.category.findFirst({
        where: { name: { contains: "food", mode: "insensitive" } },
      });
    }
    if (cat) {
      const exists = await prisma.businessCategory.findFirst({
        where: { businessId: biz.id, categoryId: cat.id },
      });
      if (!exists) {
        await prisma.businessCategory.create({ data: { businessId: biz.id, categoryId: cat.id } });
      }
    }

    // ── 9. Job ────────────────────────────────────────────────────────────
    const existingJob = await prisma.job.findFirst({ where: { businessId: biz.id } });
    if (!existingJob) {
      await prisma.job.create({
        data: {
          businessId:     biz.id,
          title:          "Line Cook",
          description:    "Passionate about Italian cuisine? Join our kitchen team. Experience with fresh pasta preferred.",
          employmentType: "FULL_TIME",
          salaryMin:      400000,
          salaryMax:      550000,
          status:         "ACTIVE",
        },
      });
    }

    // ── Redirect to the listing ───────────────────────────────────────────
    return NextResponse.redirect(
      new URL(`/business/${updated.slug}`, "http://localhost:3000")
    );

  } catch (err) {
    console.error("[seed-listing]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
