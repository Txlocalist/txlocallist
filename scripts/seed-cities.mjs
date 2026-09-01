/**
 * Seed TX Localist database with major Texas cities.
 * Run: node scripts/seed-cities.mjs
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

const TEXAS_CITIES = [
  // Top 20 by population + cultural significance
  { name: "Austin", state: "Texas", lat: 30.2672, lng: -97.7431 },
  { name: "Houston", state: "Texas", lat: 29.7604, lng: -95.3698 },
  { name: "Dallas", state: "Texas", lat: 32.7767, lng: -96.797 },
  { name: "San Antonio", state: "Texas", lat: 29.4241, lng: -98.4936 },
  { name: "Fort Worth", state: "Texas", lat: 32.7555, lng: -97.3308 },
  { name: "El Paso", state: "Texas", lat: 31.7619, lng: -106.485 },
  { name: "Arlington", state: "Texas", lat: 32.7357, lng: -97.2265 },
  { name: "Corpus Christi", state: "Texas", lat: 27.5707, lng: -97.3964 },
  { name: "Plano", state: "Texas", lat: 33.0198, lng: -96.6989 },
  { name: "Laredo", state: "Texas", lat: 27.5305, lng: -99.491 },

  // Cultural & travel destinations
  { name: "Marfa", state: "Texas", lat: 30.303, lng: -104.019 },
  { name: "Fredericksburg", state: "Texas", lat: 30.272, lng: -98.874 },
  { name: "Lockhart", state: "Texas", lat: 29.883, lng: -97.473 },
  { name: "New Braunfels", state: "Texas", lat: 29.701, lng: -97.996 },
  { name: "Galveston", state: "Texas", lat: 29.3028, lng: -94.7879 },
  { name: "Marble Falls", state: "Texas", lat: 30.566, lng: -98.286 },
  { name: "Gruene", state: "Texas", lat: 29.786, lng: -98.118 },
  { name: "Luckenbach", state: "Texas", lat: 30.381, lng: -98.638 },
  { name: "Johnson City", state: "Texas", lat: 30.277, lng: -98.399 },
  { name: "Wimberley", state: "Texas", lat: 30.088, lng: -97.837 },

  // More metro areas
  { name: "Irving", state: "Texas", lat: 32.814, lng: -96.9488 },
  { name: "Garland", state: "Texas", lat: 32.9126, lng: -96.6348 },
  { name: "Carrollton", state: "Texas", lat: 32.9712, lng: -96.8899 },
  { name: "Denton", state: "Texas", lat: 33.2148, lng: -97.133 },
  { name: "Lewisville", state: "Texas", lat: 33.0437, lng: -96.9949 },
  { name: "Frisco", state: "Texas", lat: 33.161, lng: -96.8236 },
  { name: "McKinney", state: "Texas", lat: 33.1972, lng: -96.6397 },
  { name: "Round Rock", state: "Texas", lat: 30.5028, lng: -97.6792 },
  { name: "Cedar Park", state: "Texas", lat: 30.5404, lng: -97.9204 },
  { name: "Pflugerville", state: "Texas", lat: 30.4645, lng: -97.609 },
];

async function main() {
  console.log("🌟 Seeding Texas cities...");

  let created = 0;
  let skipped = 0;

  for (const cityData of TEXAS_CITIES) {
    const slug = cityData.name.toLowerCase().replace(/\s+/g, "-");

    try {
      const city = await prisma.city.upsert({
        where: { slug },
        update: {}, // No update needed if it exists
        create: {
          name: cityData.name,
          slug,
          state: cityData.state,
          lat: cityData.lat,
          lng: cityData.lng,
        },
      });

      console.log(`✓ ${city.name}`);
      created++;
    } catch (error) {
      console.log(`⊘ ${cityData.name} (already exists or error)`);
      skipped++;
    }
  }

  console.log(`\n✨ Seeded ${created} new cities, skipped ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
