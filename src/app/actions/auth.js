"use server";

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
} from "@/lib/auth/session";
import { sendWelcomeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { authSchemaMessage, isMissingPrismaTableError } from "@/lib/prisma-errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

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

  // Fire welcome email (non-blocking — don't fail signup if email fails)
  sendWelcomeEmail({ to: email, isOwner: false }).catch((err) =>
    console.error("[auth] welcome email failed:", err)
  );

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
