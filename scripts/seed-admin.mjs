import "./load-next-environment.mjs";

import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MIN_PASSWORD_LENGTH = 12;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);

  return `${salt}:${Buffer.from(derivedKey).toString("hex")}`;
}

const connectionString = process.env.DATABASE_URL;
const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL ?? "");
const password = process.env.SEED_ADMIN_PASSWORD ?? "";

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

if (!email) {
  throw new Error("SEED_ADMIN_EMAIL is not set.");
}

if (password.length < MIN_PASSWORD_LENGTH) {
  throw new Error(
    `SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  );
}

const adapter = new PrismaNeon({
  connectionString,
});

const prisma = new PrismaClient({ adapter });

try {
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "ADMIN",
    },
    create: {
      email,
      passwordHash,
      role: "ADMIN",
    },
    select: {
      email: true,
      role: true,
    },
  });

  console.log(`Seeded admin account: ${user.email} (${user.role})`);
} finally {
  await prisma.$disconnect();
}
