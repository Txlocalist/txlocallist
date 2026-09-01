/**
 * Seed TX Localist database with categories.
 * Run: node scripts/seed-categories.mjs
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

const CATEGORIES = [
  // Food & Drink
  { name: "Bakery", icon: "🥐" },
  { name: "BBQ", icon: "🍖" },
  { name: "Cafe", icon: "☕" },
  { name: "Diner", icon: "🍽️" },
  { name: "Food Truck", icon: "🚚" },
  { name: "Italian", icon: "🍝" },
  { name: "Mexican", icon: "🌮" },
  { name: "Restaurant", icon: "🍽️" },
  { name: "Seafood", icon: "🦞" },
  { name: "Tex-Mex", icon: "🌶️" },

  // Shopping & Retail
  { name: "Antique Shop", icon: "🏺" },
  { name: "Boutique", icon: "👗" },
  { name: "Bookstore", icon: "📚" },
  { name: "Craft Store", icon: "✂️" },
  { name: "Farmers Market", icon: "🌽" },
  { name: "Flea Market", icon: "📦" },
  { name: "Gallery", icon: "🖼️" },
  { name: "Gift Shop", icon: "🎁" },
  { name: "Hardware Store", icon: "🔨" },
  { name: "Thrift Store", icon: "👕" },
  { name: "Vintage", icon: "👓" },

  // Activities & Entertainment
  { name: "Arcade", icon: "🕹️" },
  { name: "Art Studio", icon: "🎨" },
  { name: "Cinema", icon: "🎬" },
  { name: "Concert Venue", icon: "🎵" },
  { name: "Escape Room", icon: "🔓" },
  { name: "Golf Course", icon: "⛳" },
  { name: "Hiking Trail", icon: "🥾" },
  { name: "Live Music", icon: "🎸" },
  { name: "Museum", icon: "🏛️" },
  { name: "Outdoor Recreation", icon: "⛺" },
  { name: "Park", icon: "🌳" },
  { name: "Theater", icon: "🎭" },

  // Beauty & Wellness
  { name: "Gym", icon: "💪" },
  { name: "Hair Salon", icon: "✂️" },
  { name: "Massage", icon: "💆" },
  { name: "Spa", icon: "🧖" },
  { name: "Yoga Studio", icon: "🧘" },

  // Services
  { name: "Accountant", icon: "📊" },
  { name: "Contractor", icon: "🏗️" },
  { name: "Law Firm", icon: "⚖️" },
  { name: "Plumber", icon: "🔧" },
  { name: "Real Estate", icon: "🏠" },

  // Accommodation
  { name: "Bed & Breakfast", icon: "🛏️" },
  { name: "Campground", icon: "⛺" },
  { name: "Hotel", icon: "🏨" },
  { name: "Vacation Rental", icon: "🏡" },
];

async function main() {
  console.log("🏷️  Seeding categories...");

  let created = 0;
  let skipped = 0;

  for (const categoryData of CATEGORIES) {
    const slug = categoryData.name.toLowerCase().replace(/\s+/g, "-");

    try {
      const category = await prisma.category.upsert({
        where: { slug },
        update: {},
        create: {
          name: categoryData.name,
          slug,
          icon: categoryData.icon,
        },
      });

      console.log(`✓ ${category.name}`);
      created++;
    } catch (error) {
      console.log(`⊘ ${categoryData.name} (already exists or error)`);
      skipped++;
    }
  }

  console.log(`\n✨ Seeded ${created} new categories, skipped ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
