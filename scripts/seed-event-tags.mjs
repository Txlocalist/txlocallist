import "./load-next-environment.mjs";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

import { EVENT_CATEGORIES } from "../src/lib/event-categories.mjs";

function slugifyTag(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const adapter = new PrismaNeon({
  connectionString,
});

const prisma = new PrismaClient({ adapter });

try {
  await Promise.all(
    EVENT_CATEGORIES.map((name) =>
      prisma.tag.upsert({
        where: { slug: slugifyTag(name) },
        update: { name },
        create: {
          name,
          slug: slugifyTag(name),
        },
      }),
    ),
  );

  console.log(`Seeded ${EVENT_CATEGORIES.length} default event tags`);
} finally {
  await prisma.$disconnect();
}
