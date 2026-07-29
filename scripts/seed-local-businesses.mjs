/**
 * Seeds real, publicly sourced Austin businesses as free demo directory records.
 *
 * This is intentionally limited to development/demo data. It does not create
 * subscriptions, jobs, or any claim that these businesses own their listings.
 * Run: npm run db:seed-local-businesses
 */

import "dotenv/config";

import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const scrypt = promisify(scryptCallback);
const connectionString = process.env.DATABASE_URL;
const DIRECTORY_DEMO_OWNER_EMAIL = "directory-demo@txlocallist.dev";

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const AUSTIN = {
  name: "Austin",
  slug: "austin",
  state: "Texas",
  lat: 30.2672,
  lng: -97.7431,
};

const LOCAL_BUSINESSES = [
  {
    slug: "franklin-barbecue-austin",
    name: "Franklin Barbecue",
    description:
      "Austin barbecue restaurant known for slow-smoked meats and lunch served until sold out.",
    address: "900 E 11th St",
    zipCode: "78702",
    phone: "(512) 653-1187",
    website: "https://franklinbbq.com",
    category: "BBQ",
    photo: {
      url: "https://static1.squarespace.com/static/68e8046383dcbe440e273429/t/690a5519366c572b36d46630/1762284825916/Franklin+BBQ_plate.jpg?format=1500w",
      alt: "Franklin Barbecue brisket plate",
    },
  },
  {
    slug: "bookpeople-austin",
    name: "BookPeople",
    description:
      "Independent Austin bookstore serving readers with books, author events, and community programming since 1970.",
    address: "603 N Lamar Blvd",
    zipCode: "78703",
    phone: "(512) 472-5050",
    website: "https://bookpeople.com",
    category: "Bookstore",
    photo: {
      url: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=85",
      alt: "Shelves of books in an independent bookstore",
    },
  },
  {
    slug: "cosmic-coffee-beer-garden-austin",
    name: "Cosmic Coffee + Beer Garden",
    description:
      "Austin gathering place for coffee, beer, food, and outdoor patio time in a garden setting.",
    address: "121 Pickle Rd Ste 111",
    zipCode: "78704",
    phone: "(512) 763-7216",
    website: "https://cosmichospitalitygroup.com",
    category: "Cafe",
    photo: {
      url: "https://cosmichospitalitygroup.com/wp-content/uploads/2022/12/1.webp",
      alt: "Cosmic Coffee + Beer Garden artwork",
    },
  },
];

async function createPasswordHash() {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(randomBytes(32), salt, 64);
  return `${salt}:${Buffer.from(derivedKey).toString("hex")}`;
}

async function main() {
  const [owner, city, freePlan] = await Promise.all([
    prisma.user.upsert({
      where: { email: DIRECTORY_DEMO_OWNER_EMAIL },
      update: { role: "OWNER", name: "TX Localist Directory Demo" },
      create: {
        email: DIRECTORY_DEMO_OWNER_EMAIL,
        passwordHash: await createPasswordHash(),
        role: "OWNER",
        name: "TX Localist Directory Demo",
      },
    }),
    prisma.city.upsert({
      where: { slug: AUSTIN.slug },
      update: {},
      create: AUSTIN,
    }),
    prisma.plan.findUnique({ where: { slug: "free" } }),
  ]);

  for (const listing of LOCAL_BUSINESSES) {
    const categorySlug = listing.category.toLowerCase().replace(/\s+/g, "-");
    const category = await prisma.category.upsert({
      where: { slug: categorySlug },
      update: {},
      create: { name: listing.category, slug: categorySlug },
    });

    const business = await prisma.business.upsert({
      where: { slug: listing.slug },
      update: {
        name: listing.name,
        description: listing.description,
        address: listing.address,
        zipCode: listing.zipCode,
        phone: listing.phone,
        website: listing.website,
        cityId: city.id,
        ownerId: owner.id,
        planId: freePlan?.id ?? null,
        status: "ACTIVE",
        publishedAt: new Date(),
        isHiring: false,
        hiringRoles: "[]",
      },
      create: {
        slug: listing.slug,
        name: listing.name,
        description: listing.description,
        address: listing.address,
        zipCode: listing.zipCode,
        phone: listing.phone,
        website: listing.website,
        cityId: city.id,
        ownerId: owner.id,
        planId: freePlan?.id ?? null,
        status: "ACTIVE",
        publishedAt: new Date(),
        isHiring: false,
        hiringRoles: "[]",
      },
    });

    await prisma.$transaction([
      prisma.photo.deleteMany({ where: { businessId: business.id } }),
      prisma.businessCategory.deleteMany({ where: { businessId: business.id } }),
    ]);

    await prisma.$transaction([
      prisma.photo.create({
        data: { businessId: business.id, ...listing.photo, order: 0 },
      }),
      prisma.businessCategory.create({
        data: { businessId: business.id, categoryId: category.id },
      }),
    ]);

    console.log(`Seeded ${listing.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
