"use server";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSafeNextPath } from "@/lib/auth/redirect";
import {
  clearCurrentSession,
  createUserSession,
  getDashboardPath,
  normalizeEmail,
  requireAdmin,
  requireUser,
} from "@/lib/auth/session";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { authSchemaMessage, isMissingPrismaTableError } from "@/lib/prisma-errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;
const RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

function getTextValue(formData, fieldName) {
  return formData.get(fieldName)?.toString().trim() ?? "";
}

function buildErrorState(error, fieldErrors = {}) {
  return {
    error,
    fieldErrors,
  };
}

function validateCredentials({ email, password, confirmPassword }) {
  const fieldErrors = {};

  if (!EMAIL_REGEX.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  return fieldErrors;
}

function getResetSecret() {
  // Prefer a dedicated/session signing key, while retaining compatibility with
  // existing deployments that already have a strong server-only cron secret.
  return process.env.PASSWORD_RESET_SECRET || process.env.SESSION_SECRET || process.env.CRON_SECRET || "";
}

function encodeResetToken(user) {
  const secret = getResetSecret();
  if (!secret) throw new Error("Password reset is not configured.");
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    exp: Date.now() + RESET_TOKEN_LIFETIME_MS,
    password: createHash("sha256").update(user.passwordHash).digest("hex").slice(0, 16),
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function readResetToken(token) {
  const secret = getResetSecret();
  const [payload, signature] = String(token || "").split(".");
  if (!secret || !payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let provided;
  try { provided = Buffer.from(signature, "base64url"); } catch { return null; }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
  if (!claims.id || !claims.exp || claims.exp < Date.now()) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.id }, select: { id: true, passwordHash: true, deletedAt: true } });
  if (!user || user.deletedAt) return null;
  const fingerprint = createHash("sha256").update(user.passwordHash).digest("hex").slice(0, 16);
  return fingerprint === claims.password ? user : null;
}

export async function requestPasswordResetAction(_prevState, formData) {
  const email = normalizeEmail(getTextValue(formData, "email"));
  const success = "If an account exists for that email, a reset link is on its way.";
  if (!EMAIL_REGEX.test(email)) return { error: "Enter a valid email address.", success: "" };
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true, deletedAt: true } });
  if (user && !user.deletedAt) {
    if (!getResetSecret()) {
      console.error("[auth] password reset requires PASSWORD_RESET_SECRET or SESSION_SECRET");
      return { error: "Password reset is temporarily unavailable. Please contact support.", success: "" };
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const resetUrl = `${site}/reset-password?token=${encodeURIComponent(encodeResetToken(user))}`;
    const delivery = await sendPasswordResetEmail({ to: user.email, resetUrl });
    if (!delivery.success) {
      console.error("[auth] password reset email was not accepted by the provider");
      return {
        error: "We could not send the reset email. The site email domain may still need verification.",
        success: "",
      };
    }
  }
  return { error: "", success };
}

export async function resetPasswordAction(_prevState, formData) {
  const token = formData.get("token")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";
  const fieldErrors = validateCredentials({ email: "valid@example.com", password, confirmPassword });
  delete fieldErrors.email;
  if (Object.keys(fieldErrors).length) return buildErrorState("Fix the highlighted fields and try again.", fieldErrors);
  const user = await readResetToken(token);
  if (!user) return buildErrorState("This reset link is invalid or has expired. Request a new one.");
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  redirect("/login?reset=1");
}

export async function updateProfileAction(_prevState, formData) {
  const user = await requireUser();
  const name = getTextValue(formData, "name");
  if (name.length > 80) return buildErrorState("Name must be 80 characters or fewer.", { name: "Shorten this name." });
  await prisma.user.update({ where: { id: user.id }, data: { name: name || null } });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { error: "", fieldErrors: {}, success: "Profile updated." };
}

export async function signUpAction(_prevState, formData) {
  const email = normalizeEmail(getTextValue(formData, "email"));
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";
  const intent = getTextValue(formData, "intent");
  const nextPath = getSafeNextPath(getTextValue(formData, "next"));
  const fieldErrors = validateCredentials({
    email,
    password,
    confirmPassword,
  });

  if (Object.keys(fieldErrors).length > 0) {
    return buildErrorState("Fix the highlighted fields and try again.", fieldErrors);
  }

  let existingUser;

  try {
    existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    return buildErrorState(`${authSchemaMessage} Run the Prisma schema sync, then try again.`);
  }

  if (existingUser) {
    return buildErrorState("An account already exists for that email.", {
      email: "Use a different email or log in instead.",
    });
  }

  const passwordHash = await hashPassword(password);
  let user;

  const assignedRole = "USER";

  try {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: assignedRole,
      },
      select: {
        id: true,
        role: true,
      },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    return buildErrorState(`${authSchemaMessage} Run the Prisma schema sync, then try again.`);
  }

  const sessionCreated = await createUserSession(user.id);

  if (!sessionCreated) {
    return buildErrorState(`${authSchemaMessage} Your account was created, but sign-in cannot start until the session table exists.`);
  }

  // The email helper reports provider failures without throwing, so account
  // creation still succeeds while serverless runtimes get time to send it.
  await sendWelcomeEmail({ to: email, isOwner: intent === "owner" });

  if (nextPath) {
    redirect(nextPath);
  }

  if (intent === "owner") {
    redirect("/dashboard/billing");
  }

  redirect(getDashboardPath(user.role));
}

export async function createStaffAction(_prevState, formData) {
  await requireAdmin();

  const email = normalizeEmail(getTextValue(formData, "email"));
  const role = getTextValue(formData, "role") || "MANAGER";
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";
  const fieldErrors = validateCredentials({
    email,
    password,
    confirmPassword,
  });

  if (!["MANAGER", "ADMIN"].includes(role)) {
    fieldErrors.role = "Choose Manager or Admin.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return buildErrorState("Fix the highlighted fields and try again.", fieldErrors);
  }

  let existingUser;

  try {
    existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    return buildErrorState(`${authSchemaMessage} Run the Prisma schema sync before creating staff.`);
  }

  if (existingUser) {
    return buildErrorState("That email already belongs to an existing account.", {
      email: "Use an email that is not already registered.",
    });
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
      },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    return buildErrorState(`${authSchemaMessage} Run the Prisma schema sync before creating staff.`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");

  return {
    error: "",
    fieldErrors: {},
    success: `${role === "ADMIN" ? "Admin" : "Manager"} account created for ${email}.`,
  };
}

export async function loginAction(_prevState, formData) {
  const email = normalizeEmail(getTextValue(formData, "email"));
  const password = formData.get("password")?.toString() ?? "";
  const nextPath = getSafeNextPath(getTextValue(formData, "next"));

  if (!EMAIL_REGEX.test(email) || !password) {
    return buildErrorState("Enter your email and password to continue.", {
      email: !EMAIL_REGEX.test(email) ? "Enter a valid email address." : "",
      password: !password ? "Enter your password." : "",
    });
  }

  let user;

  try {
    user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
        passwordHash: true,
        deletedAt: true,
      },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    return buildErrorState(`${authSchemaMessage} Run the Prisma schema sync, then log in again.`);
  }

  if (!user || user.deletedAt) {
    return buildErrorState("Invalid email or password.");
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    return buildErrorState("Invalid email or password.");
  }

  try {
    const updated = await prisma.user.updateMany({
      where: { id: user.id, deletedAt: null },
      data: { lastLoginAt: new Date() },
    });
    if (updated.count !== 1) return buildErrorState("Invalid email or password.");
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    return buildErrorState(`${authSchemaMessage} Run the Prisma schema sync, then log in again.`);
  }

  const sessionCreated = await createUserSession(user.id);

  if (!sessionCreated) {
    return buildErrorState(`${authSchemaMessage} Login cannot complete until the session table exists.`);
  }

  redirect(nextPath || getDashboardPath(user.role));
}

export async function logoutAction() {
  await clearCurrentSession();
  redirect("/login");
}
