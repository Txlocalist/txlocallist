import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

const SESSION_COOKIE_NAME = "txlocallist_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_TTL_MS = SESSION_MAX_AGE_SECONDS * 1000;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionCookieOptions(expiresAt) {
  return {
    expires: expiresAt,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function getDashboardPath(role) {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

export async function createUserSession(userId) {
  const sessionToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  try {
    await prisma.session.deleteMany({
      where: {
        OR: [
          { userId, expiresAt: { lt: new Date() } },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    await prisma.session.create({
      data: {
        expiresAt,
        tokenHash,
        userId,
      },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    return false;
  }

  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    sessionToken,
    getSessionCookieOptions(expiresAt),
  );

  return true;
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    try {
      await prisma.session.deleteMany({
        where: { tokenHash: hashToken(sessionToken) },
      });
    } catch (error) {
      if (!isMissingPrismaTableError(error)) {
        throw error;
      }
    }
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(new Date(0)),
    maxAge: 0,
  });
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  let session = null;

  try {
    session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(sessionToken) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            accountPlanId: true,
            billingStatus: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    return null;
  }

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return session;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();

  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return user;
}
