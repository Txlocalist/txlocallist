import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { isBillingMutationFenceEnabled } from "@/lib/runtime-config.mjs";

export const BILLING_MUTATION_KIND = Object.freeze({
  CHECKOUT: "SUBSCRIPTION_CHECKOUT",
  PORTAL: "BILLING_PORTAL",
  COMPLIMENTARY_ROLE: "COMPLIMENTARY_ROLE",
});

export const MEMBERSHIP_CHECKOUT_SECONDS = 31 * 60;
const CHECKOUT_FENCE_BUFFER_MS = 5 * 60 * 1000;
const PORTAL_FENCE_TTL_MS = 2 * 60 * 60 * 1000;

function mutationError() {
  return Object.assign(
    new Error(
      "Billing is already changing for this account. Finish the current billing or role-change operation before trying again.",
    ),
    { code: "BILLING_MUTATION_IN_PROGRESS" },
  );
}

function fenceLostError() {
  return Object.assign(
    new Error("The billing safety lock expired before the operation completed. Please try again."),
    { code: "BILLING_MUTATION_FENCE_LOST" },
  );
}

function isUniqueConstraintError(error) {
  return error?.code === "P2002";
}

export function newBillingMutationKey(prefix) {
  return `${prefix}:${randomUUID()}`;
}

export function checkoutFenceExpiresAt(checkoutExpiresAtSeconds) {
  return new Date(checkoutExpiresAtSeconds * 1000 + CHECKOUT_FENCE_BUFFER_MS);
}

export function portalFenceExpiresAt(now = Date.now()) {
  return new Date(now + PORTAL_FENCE_TTL_MS);
}

export function roleTransitionFenceKey(operationId) {
  return `complimentary-role:${operationId}`;
}

export async function acquireBillingMutationFence(
  { userId, kind, operationKey, expiresAt },
  db = prisma,
) {
  if (!isBillingMutationFenceEnabled()) return null;

  await db.billingMutationFence.deleteMany({
    where: {
      userId,
      expiresAt: { lte: new Date() },
    },
  });

  try {
    return await db.billingMutationFence.create({
      data: {
        userId,
        kind,
        operationKey,
        expiresAt,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw mutationError();
    throw error;
  }
}

export async function claimRoleTransitionFence(
  { userId, operationId, expiresAt = null },
  db = prisma,
) {
  if (!isBillingMutationFenceEnabled()) return null;

  const operationKey = roleTransitionFenceKey(operationId);
  const claimed = await db.billingMutationFence.updateMany({
    where: { userId, operationKey },
    data: { expiresAt },
  });
  if (claimed.count > 0) return operationKey;

  await acquireBillingMutationFence(
    {
      userId,
      kind: BILLING_MUTATION_KIND.COMPLIMENTARY_ROLE,
      operationKey,
      expiresAt,
    },
    db,
  );
  return operationKey;
}

export async function attachStripeSessionToFence(
  { userId, operationKey, stripeSessionId, expiresAt },
  db = prisma,
) {
  if (!isBillingMutationFenceEnabled()) return false;

  const attached = await db.billingMutationFence.updateMany({
    where: { userId, operationKey },
    data: { stripeSessionId, expiresAt },
  });
  if (attached.count === 0) throw fenceLostError();
  return true;
}

export async function transferBillingMutationFence(
  { userId, fromOperationKey, toOperationKey, expiresAt },
  db = prisma,
) {
  if (!isBillingMutationFenceEnabled()) return false;

  const transferred = await db.billingMutationFence.updateMany({
    where: { userId, operationKey: fromOperationKey },
    data: { operationKey: toOperationKey, expiresAt },
  });
  if (transferred.count === 0) throw fenceLostError();
  return true;
}

export async function releaseBillingMutationFence(
  { userId, operationKey },
  db = prisma,
) {
  if (!isBillingMutationFenceEnabled()) return false;

  const released = await db.billingMutationFence.deleteMany({
    where: { userId, operationKey },
  });
  return released.count > 0;
}

export async function releaseStripeSessionFence(
  { userId, operationKey, stripeSessionId },
  db = prisma,
) {
  if (!isBillingMutationFenceEnabled()) return false;
  if (!userId || !operationKey || !stripeSessionId) return false;

  const released = await db.billingMutationFence.deleteMany({
    where: { userId, operationKey, stripeSessionId },
  });
  return released.count > 0;
}

export async function releaseFenceFromStripeSession(session, db = prisma) {
  return releaseStripeSessionFence(
    {
      userId: session?.metadata?.ownerId,
      operationKey: session?.metadata?.billingMutationKey,
      stripeSessionId: session?.id,
    },
    db,
  );
}
