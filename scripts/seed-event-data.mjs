/**
 * Migrate existing Event data to Business table.
 * Run this AFTER:
 *   - prisma migrate deploy (to apply the new schema)
 *   - seed-cities.mjs (to ensure cities exist)
 *   - seed-plans.mjs (to create the Free plan)
 *
 * Run: node scripts/seed-event-data.mjs
 */

import "./load-next-environment.mjs";

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

async function main() {
  console.log("📦 Migrating Event records to Business...");

  // Get the Free plan (tier 0)
  const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });

  if (!freePlan) {
    console.error(
      "❌ Free plan not found. Run seed-plans.mjs first.\n"
    );
    process.exit(1);
  }

  let events = [];

  try {
    events = await prisma.$queryRaw`SELECT * FROM "Event"`;
  } catch {
    try {
      events = await prisma.$queryRaw`SELECT * FROM "Event_backup"`;
    } catch {
      console.log("No Event or Event_backup table found. Nothing to migrate.");
      return;
    }
  }

  if (events.length === 0) {
    console.log("✓ No Event records to migrate.");
    return;
  }

  let migrated = 0;
  let failed = 0;

  for (const event of events) {
    try {
      // Find or create the city
      const citySlug = event.city.toLowerCase().replace(/\s+/g, "-");
      let city = await prisma.city.findUnique({ where: { slug: citySlug } });

      if (!city) {
        // If city doesn't exist, create it
        city = await prisma.city.create({
          data: {
            name: event.city,
            slug: citySlug,
            state: event.state || "Texas",
          },
        });
      }

      // Create the Business record
      const slug = `${event.title
        .toLowerCase()
        .replace(/\s+/g, "-")}-${event.city.toLowerCase().replace(/\s+/g, "-")}`;

      const business = await prisma.business.create({
        data: {
          slug,
          name: event.title,
          description: event.description,
          address: event.address,
          addressName: event.addressName || event.title,
          zipCode: event.zipCode,
          cityId: city.id,
          state: event.state || "Texas",
          country: event.country || "USA",
          ownerId: event.creatorId,
          planId: freePlan.id,
          status: "ACTIVE",
          publishedAt: event.createdAt,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
          // Note: Event.imageUrl becomes the first Photo in a future step
        },
      });

      // If event had an imageUrl, create a Photo record
      if (event.imageUrl) {
        await prisma.photo.create({
          data: {
            businessId: business.id,
            url: event.imageUrl,
            alt: event.title,
            order: 0,
          },
        });
      }

      // Migrate tags (assuming Event.tags is a many-to-many in the old schema)
      // This step depends on whether tags were actually related to events.
      // If yes, uncomment and adapt:
      // const eventTags = await prisma.$queryRaw`
      //   SELECT * FROM "_EventToTag" WHERE "A" = ${event.id}
      // `;
      // for (const et of eventTags) {
      //   await prisma.businessTag.create({
      //     data: { businessId: business.id, tagId: et.B },
      //   });
      // }

      console.log(`✓ ${business.name} (${business.slug})`);
      migrated++;
    } catch (error) {
      console.log(`⊘ ${event.title} - ${error.message}`);
      failed++;
    }
  }

  console.log(
    `\n✨ Migrated ${migrated} businesses, ${failed} failed\n`
  );
  console.log("Next steps:");
  console.log("  1. Verify the Business records in your database");
  console.log("  2. (Optional) Drop the Event table: DROP TABLE Event CASCADE;");
  console.log("  3. Update src/app/actions/ to use Business instead of Event");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
