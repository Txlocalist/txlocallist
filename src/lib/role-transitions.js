import { ACCOUNT_ROLES, syncEffectiveAccessPlans } from "@/lib/account-access";
import {
  syncStripeSubscriptionObject,
  syncSubscriptionFromCheckoutSessionId,
} from "@/lib/billing";
import {
  acquireBillingMutationFence,
  BILLING_MUTATION_KIND,
  claimRoleTransitionFence,
  newBillingMutationKey,
  releaseBillingMutationFence,
  roleTransitionFenceKey,
  transferBillingMutationFence,
} from "@/lib/billing-mutation-fence";
import { prisma } from "@/lib/prisma";
import { assertComplimentaryRoleMutationEnabled } from "@/lib/runtime-config.mjs";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getStripeSubscriptionPeriodEnd } from "@/lib/subscription-period";

const PREVIEW_TTL_MS = 10 * 60 * 1000;
const RENEWAL_CAPABLE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
  "paused",
]);
const TERMINAL_STATUSES = new Set(["canceled", "incomplete_expired"]);

export function roleTransitionRequiresCancellation(toRole) {
  return toRole === "COMPLIMENTARY";
}

function cleanError(error) {
  return {
    code: error?.code?.toString().slice(0, 100) || "ROLE_TRANSITION_FAILED",
    message:
      (error instanceof Error ? error.message : "Role transition failed.").slice(0, 1000),
  };
}

function assertAllowedRole(role) {
  if (!ACCOUNT_ROLES.includes(role)) {
    throw Object.assign(new Error("Choose a valid account role."), {
      code: "INVALID_ROLE",
    });
  }
}

async function assertRoleTransitionAllowed({ actorId, target, toRole, db = prisma }) {
  assertAllowedRole(toRole);
  if (!target) throw Object.assign(new Error("User not found."), { code: "USER_NOT_FOUND" });
  if (target.deletedAt) {
    throw Object.assign(new Error("Deleted accounts cannot be assigned a role."), {
      code: "USER_DELETED",
    });
  }
  if (actorId === target.id) {
    throw Object.assign(new Error("Ask another Admin to change your role."), {
      code: "SELF_ROLE_CHANGE",
    });
  }
  if (target.role === toRole) {
    throw Object.assign(new Error("This account already has that role."), {
      code: "ROLE_UNCHANGED",
    });
  }
  if (target.role === "ADMIN" && toRole !== "ADMIN") {
    const adminCount = await db.user.count({
      where: { role: "ADMIN", deletedAt: null },
    });
    if (adminCount <= 1) {
      throw Object.assign(new Error("The final Admin cannot be demoted."), {
        code: "LAST_ADMIN",
      });
    }
  }
}

export function roleTransitionMayHaveStripeSideEffects(operation) {
  if (["PROCESSING", "PARTIAL", "STRIPE_VERIFIED"].includes(operation.status)) {
    return true;
  }

  return operation.subscriptions?.some(
    (subscription) =>
      subscription.result === "SCHEDULED" || subscription.attemptCount > 0,
  ) ?? false;
}

function priceIdForSubscription(subscription) {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

function subscriptionSummary(subscription, sources) {
  const items = subscription.items?.data ?? [];
  const amountCents = items.reduce((total, item) => {
    const unitAmount = item.price?.unit_amount;
    return Number.isInteger(unitAmount)
      ? total + unitAmount * (item.quantity ?? 1)
      : total;
  }, 0);
  return {
    stripeSubscriptionId: subscription.id,
    sources: Array.from(sources),
    stripeStatus: subscription.status,
    amountCents: amountCents || null,
    currency: items.find((item) => item.price?.currency)?.price?.currency ?? null,
    priorCancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodEnd: getStripeSubscriptionPeriodEnd(subscription),
    result: TERMINAL_STATUSES.has(subscription.status)
      ? "TERMINAL"
      : subscription.cancel_at_period_end
        ? "ALREADY_SCHEDULED"
        : "PENDING",
  };
}

async function loadTransitionTarget(targetUserId) {
  return prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      roleVersion: true,
      deletedAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      ownedBusinesses: {
        select: {
          id: true,
          subscription: {
            select: {
              stripeCustomerId: true,
              stripeSubscriptionId: true,
            },
          },
        },
      },
    },
  });
}

function stripeCustomerIdsForTarget(target) {
  const customerIds = new Set();
  if (target.stripeCustomerId) customerIds.add(target.stripeCustomerId);
  for (const business of target.ownedBusinesses) {
    if (business.subscription?.stripeCustomerId) {
      customerIds.add(business.subscription.stripeCustomerId);
    }
  }
  return customerIds;
}

async function expireOpenAccountCheckoutSessions(target) {
  const customerIds = stripeCustomerIdsForTarget(target);
  if (customerIds.size === 0) return [];
  if (!isStripeConfigured()) {
    throw Object.assign(
      new Error("Stripe must be available before Complimentary access can replace billing."),
      { code: "STRIPE_UNAVAILABLE" },
    );
  }

  const stripe = getStripe();
  const expiredSessionIds = [];
  for (const customerId of customerIds) {
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      status: "open",
      limit: 100,
    });
    if (sessions.has_more) {
      throw Object.assign(
        new Error("Stripe returned too many open Checkout sessions for automatic review."),
        { code: "CHECKOUT_REVIEW_REQUIRED" },
      );
    }

    for (const session of sessions.data) {
      if (session.metadata?.scope !== "account") continue;
      const ownerId = session.metadata?.ownerId || session.client_reference_id;
      if (ownerId && ownerId !== target.id) {
        throw Object.assign(
          new Error("A Stripe Checkout session belongs to another account."),
          { code: "STRIPE_OWNERSHIP_MISMATCH" },
        );
      }
      if (!ownerId) continue;

      try {
        await stripe.checkout.sessions.expire(session.id);
        expiredSessionIds.push(session.id);
      } catch (error) {
        const current = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["subscription"],
        });
        if (current.status === "expired") {
          expiredSessionIds.push(session.id);
          continue;
        }
        if (current.status === "complete" || current.payment_status === "paid") {
          await syncSubscriptionFromCheckoutSessionId(current.id, target.id);
          continue;
        }
        throw Object.assign(
          new Error("An account Checkout is still processing. Wait for Stripe to finish, then review the role change again."),
          { code: "CHECKOUT_IN_PROGRESS", cause: error },
        );
      }
    }
  }
  return expiredSessionIds;
}

async function discoverStripeSubscriptions(target) {
  const localSources = new Map();
  const customerIds = stripeCustomerIdsForTarget(target);
  const ownedBusinessIds = new Set(target.ownedBusinesses.map((business) => business.id));

  if (target.stripeSubscriptionId) {
    localSources.set(target.stripeSubscriptionId, new Set(["ACCOUNT"]));
  }
  for (const business of target.ownedBusinesses) {
    const subscription = business.subscription;
    if (subscription?.stripeSubscriptionId) {
      const sources = localSources.get(subscription.stripeSubscriptionId) ?? new Set();
      sources.add("LEGACY");
      localSources.set(subscription.stripeSubscriptionId, sources);
    }
  }

  if (localSources.size === 0 && customerIds.size === 0) return [];
  if (!isStripeConfigured()) {
    throw Object.assign(
      new Error("Stripe must be available before Complimentary access can replace a linked subscription."),
      { code: "STRIPE_UNAVAILABLE" },
    );
  }

  const configuredPlans = await prisma.plan.findMany({
    where: { stripePriceId: { not: null } },
    select: { stripePriceId: true },
  });
  const configuredPriceIds = new Set(configuredPlans.map((plan) => plan.stripePriceId));
  const stripe = getStripe();
  const subscriptions = new Map();

  for (const [subscriptionId, sources] of localSources) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    const metadataOwnerId = subscription.metadata?.ownerId;
    if (metadataOwnerId && metadataOwnerId !== target.id) {
      throw Object.assign(new Error("A linked Stripe subscription belongs to another account."), {
        code: "STRIPE_OWNERSHIP_MISMATCH",
      });
    }
    if (!configuredPriceIds.has(priceIdForSubscription(subscription))) {
      throw Object.assign(new Error("A linked subscription does not match a configured TX Localist plan."), {
        code: "STRIPE_PLAN_MISMATCH",
      });
    }
    if (subscription.schedule) {
      throw Object.assign(new Error("A subscription schedule must be reviewed in Stripe first."), {
        code: "STRIPE_SCHEDULE_MANAGED",
      });
    }
    subscriptions.set(subscription.id, { subscription, sources: new Set(sources) });
  }

  for (const customerId of customerIds) {
    const listed = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      expand: ["data.items.data.price"],
    });

    for (const subscription of listed.data) {
      const isLocallyLinked = localSources.has(subscription.id);
      const metadataOwnerId = subscription.metadata?.ownerId;
      const metadataBusinessId = subscription.metadata?.businessId;
      if (metadataOwnerId && metadataOwnerId !== target.id) {
        throw Object.assign(new Error("A Stripe customer contains a subscription linked to another account."), {
          code: "STRIPE_OWNERSHIP_MISMATCH",
        });
      }
      if (metadataBusinessId && !ownedBusinessIds.has(metadataBusinessId)) {
        throw Object.assign(new Error("A Stripe customer contains a subscription linked to a business this account does not own."), {
          code: "STRIPE_BUSINESS_MISMATCH",
        });
      }
      const isMetadataLinked =
        metadataOwnerId === target.id || ownedBusinessIds.has(metadataBusinessId);
      const isConfiguredPlan = configuredPriceIds.has(priceIdForSubscription(subscription));
      if (!isLocallyLinked && !isMetadataLinked && !isConfiguredPlan) continue;
      if (subscription.schedule) {
        throw Object.assign(new Error("A subscription schedule must be reviewed in Stripe first."), {
          code: "STRIPE_SCHEDULE_MANAGED",
        });
      }

      const current = subscriptions.get(subscription.id) ?? {
        subscription,
        sources: new Set(),
      };
      current.subscription = subscription;
      current.sources.add(isMetadataLinked ? "STRIPE_CUSTOMER" : "ACCOUNT");
      subscriptions.set(subscription.id, current);
    }
  }

  return Array.from(subscriptions.values()).map(({ subscription, sources }) =>
    subscriptionSummary(subscription, sources),
  );
}

async function writeAudit({ actorId, action, targetUserId, meta = {} }, db = prisma) {
  return db.auditLog.create({
    data: {
      actorId,
      action,
      entity: "User",
      entityId: targetUserId,
      meta: JSON.stringify(meta),
    },
  });
}

export async function previewRoleTransition({ actorId, targetUserId, toRole }) {
  const target = await loadTransitionTarget(targetUserId);
  await assertRoleTransitionAllowed({ actorId, target, toRole });
  assertComplimentaryRoleMutationEnabled({
    fromRole: target.role,
    toRole,
  });
  const requiresCancellation = roleTransitionRequiresCancellation(toRole);
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS);
  const preparationKey = requiresCancellation
    ? newBillingMutationKey("complimentary-preview")
    : null;
  let subscriptions = [];
  let expiredCheckoutSessionIds = [];

  try {
    if (requiresCancellation) {
      await prisma.$transaction((tx) => acquireBillingMutationFence(
        {
          userId: target.id,
          kind: BILLING_MUTATION_KIND.COMPLIMENTARY_ROLE,
          operationKey: preparationKey,
          expiresAt,
        },
        tx,
      ));
      expiredCheckoutSessionIds = await expireOpenAccountCheckoutSessions(target);
      subscriptions = await discoverStripeSubscriptions(target);
    }

    const operation = await prisma.$transaction(async (tx) => {
      const activeOperation = await tx.roleTransitionOperation.findUnique({
        where: { activeTargetKey: target.id },
        select: { id: true, status: true, toRole: true },
      });
      if (
        activeOperation &&
        ["PROCESSING", "PARTIAL", "STRIPE_VERIFIED", "NEEDS_ATTENTION"].includes(
          activeOperation.status,
        )
      ) {
        throw Object.assign(
          new Error("This account already has a role change that must be finished or reviewed."),
          { code: "ROLE_TRANSITION_IN_PROGRESS" },
        );
      }
      if (activeOperation) {
        await tx.roleTransitionOperation.update({
          where: { id: activeOperation.id },
          data: { status: "EXPIRED", activeTargetKey: null },
        });
        if (roleTransitionRequiresCancellation(activeOperation.toRole)) {
          await releaseBillingMutationFence(
            {
              userId: target.id,
              operationKey: roleTransitionFenceKey(activeOperation.id),
            },
            tx,
          );
        }
      }

      const created = await tx.roleTransitionOperation.create({
        data: {
          actorId,
          targetUserId: target.id,
          fromRole: target.role,
          toRole,
          targetRoleVersion: target.roleVersion,
          activeTargetKey: target.id,
          expiresAt,
          subscriptions: {
            create: subscriptions.map((subscription) => ({
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              sources: JSON.stringify(subscription.sources),
              stripeStatus: subscription.stripeStatus,
              amountCents: subscription.amountCents,
              currency: subscription.currency,
              priorCancelAtPeriodEnd: subscription.priorCancelAtPeriodEnd,
              currentPeriodEnd: subscription.currentPeriodEnd,
              result: subscription.result,
            })),
          },
        },
        include: { subscriptions: true },
      });

      if (requiresCancellation) {
        await transferBillingMutationFence(
          {
            userId: target.id,
            fromOperationKey: preparationKey,
            toOperationKey: roleTransitionFenceKey(created.id),
            expiresAt,
          },
          tx,
        );
      }

      await writeAudit(
        {
          actorId,
          action: "ROLE_TRANSITION_PREVIEWED",
          targetUserId: target.id,
          meta: {
            operationId: created.id,
            fromRole: target.role,
            toRole,
            stripeSubscriptionIds: subscriptions.map((item) => item.stripeSubscriptionId),
            expiredCheckoutSessionIds,
          },
        },
        tx,
      );
      return created;
    });

    return {
      id: operation.id,
      target: {
        id: target.id,
        email: target.email,
        name: target.name,
        role: target.role,
      },
      toRole,
      expiresAt: expiresAt.toISOString(),
      subscriptions: operation.subscriptions.map((subscription) => ({
        id: subscription.stripeSubscriptionId,
        status: subscription.stripeStatus,
        amountCents: subscription.amountCents,
        currency: subscription.currency,
        cancelAtPeriodEnd: subscription.priorCancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      })),
    };
  } catch (error) {
    if (preparationKey) {
      await releaseBillingMutationFence({
        userId: target.id,
        operationKey: preparationKey,
      }).catch(() => null);
    }
    throw error;
  }
}

async function failOperation(operation, status, error) {
  const clean = cleanError(error);
  const updated = await prisma.roleTransitionOperation.updateMany({
    where: { id: operation.id, status: { not: "COMPLETED" } },
    data: {
      status,
      errorCode: clean.code,
      errorMessage: clean.message,
      ...(status === "EXPIRED" ? { activeTargetKey: null } : {}),
    },
  }).catch(() => null);
  if (updated?.count) {
    await writeAudit({
      actorId: operation.actorId,
      action: "ROLE_TRANSITION_FAILED",
      targetUserId: operation.targetUserId,
      meta: { operationId: operation.id, status, ...clean },
    }).catch(() => null);
  }
  if (status === "EXPIRED" && roleTransitionRequiresCancellation(operation.toRole)) {
    await releaseBillingMutationFence({
      userId: operation.targetUserId,
      operationKey: roleTransitionFenceKey(operation.id),
    }).catch(() => null);
  }
  throw error;
}

export async function confirmRoleTransition({ actorId, operationId, confirmed }) {
  if (!confirmed) throw new Error("Confirm the role change before continuing.");

  const operation = await prisma.roleTransitionOperation.findUnique({
    where: { id: operationId },
    include: { subscriptions: true },
  });
  if (!operation) {
    throw Object.assign(new Error("Role-change preview not found."), { code: "PREVIEW_NOT_FOUND" });
  }
  if (operation.status === "COMPLETED") return operation;
  const mayHaveStripeSideEffects = roleTransitionMayHaveStripeSideEffects(operation);
  if (operation.expiresAt <= new Date() && !mayHaveStripeSideEffects) {
    return failOperation(operation, "EXPIRED", Object.assign(new Error("This preview expired. Review the role change again."), { code: "PREVIEW_EXPIRED" }));
  }
  if (
    ![
      "PREVIEWED",
      "PROCESSING",
      "PARTIAL",
      "STRIPE_VERIFIED",
      "NEEDS_ATTENTION",
    ].includes(operation.status)
  ) {
    throw Object.assign(new Error("This role change needs an Admin review before retrying."), {
      code: "OPERATION_NOT_RETRYABLE",
    });
  }

  const target = await loadTransitionTarget(operation.targetUserId);
  try {
    if (!mayHaveStripeSideEffects) {
      assertComplimentaryRoleMutationEnabled({
        fromRole: operation.fromRole,
        toRole: operation.toRole,
      });
    }
    await assertRoleTransitionAllowed({ actorId, target, toRole: operation.toRole });
  } catch (error) {
    return failOperation(
      operation,
      mayHaveStripeSideEffects ? "NEEDS_ATTENTION" : "EXPIRED",
      error,
    );
  }
  if (target.role !== operation.fromRole || target.roleVersion !== operation.targetRoleVersion) {
    return failOperation(
      operation,
      mayHaveStripeSideEffects ? "NEEDS_ATTENTION" : "EXPIRED",
      Object.assign(new Error("The account role changed. Review the request again."), {
        code: "STALE_ROLE_VERSION",
      }),
    );
  }

  if (roleTransitionRequiresCancellation(operation.toRole)) {
    try {
      await prisma.$transaction((tx) => claimRoleTransitionFence(
        {
          userId: operation.targetUserId,
          operationId: operation.id,
          expiresAt: null,
        },
        tx,
      ));
    } catch (error) {
      return failOperation(
        operation,
        mayHaveStripeSideEffects ? "NEEDS_ATTENTION" : "EXPIRED",
        error,
      );
    }
  }

  if (roleTransitionRequiresCancellation(operation.toRole) && operation.status !== "STRIPE_VERIFIED") {
    let currentSubscriptions;
    try {
      currentSubscriptions = await discoverStripeSubscriptions(target);
    } catch (error) {
      return failOperation(operation, "NEEDS_ATTENTION", error);
    }
    const previewIds = operation.subscriptions.map((item) => item.stripeSubscriptionId).sort();
    const currentIds = currentSubscriptions.map((item) => item.stripeSubscriptionId).sort();
    if (JSON.stringify(previewIds) !== JSON.stringify(currentIds)) {
      return failOperation(
        operation,
        mayHaveStripeSideEffects ? "NEEDS_ATTENTION" : "EXPIRED",
        Object.assign(new Error("Subscriptions changed. Review the role change again."), {
          code: "SUBSCRIPTIONS_CHANGED",
        }),
      );
    }

    await prisma.roleTransitionOperation.update({
      where: { id: operation.id },
      data: { status: "PROCESSING", errorCode: null, errorMessage: null },
    });

    let failed = false;
    for (const candidate of currentSubscriptions) {
      const local = operation.subscriptions.find(
        (item) => item.stripeSubscriptionId === candidate.stripeSubscriptionId,
      );
      if (!local) continue;

      if (TERMINAL_STATUSES.has(candidate.stripeStatus)) {
        await prisma.roleTransitionSubscription.update({
          where: { id: local.id },
          data: { result: "TERMINAL", stripeStatus: candidate.stripeStatus },
        });
        continue;
      }
      if (candidate.priorCancelAtPeriodEnd) {
        await prisma.roleTransitionSubscription.update({
          where: { id: local.id },
          data: { result: "ALREADY_SCHEDULED", stripeStatus: candidate.stripeStatus },
        });
        continue;
      }

      try {
        const updated = await getStripe().subscriptions.update(
          candidate.stripeSubscriptionId,
          { cancel_at_period_end: true, proration_behavior: "none" },
          {
            idempotencyKey: `complimentary-grant:${operation.id}:${candidate.stripeSubscriptionId}:cancel:v1`,
          },
        );
        await syncStripeSubscriptionObject(updated);
        await prisma.roleTransitionSubscription.update({
          where: { id: local.id },
          data: {
            result: "SCHEDULED",
            stripeStatus: updated.status,
            priorCancelAtPeriodEnd: Boolean(updated.cancel_at_period_end),
            currentPeriodEnd: getStripeSubscriptionPeriodEnd(updated),
            attemptCount: { increment: 1 },
            stripeRequestId: updated.lastResponse?.requestId ?? null,
            errorCode: null,
            errorMessage: null,
          },
        });
      } catch (error) {
        failed = true;
        const clean = cleanError(error);
        await prisma.roleTransitionSubscription.update({
          where: { id: local.id },
          data: {
            result: "FAILED",
            attemptCount: { increment: 1 },
            errorCode: clean.code,
            errorMessage: clean.message,
          },
        });
      }
    }

    if (failed) {
      return failOperation(operation, "PARTIAL", Object.assign(new Error("Some renewals could not be scheduled. Successful cancellations remain in place; retry this operation from User Management."), { code: "PARTIAL_STRIPE_FAILURE" }));
    }

    for (const candidate of currentSubscriptions) {
      if (!RENEWAL_CAPABLE_STATUSES.has(candidate.stripeStatus)) continue;
      const verified = await getStripe().subscriptions.retrieve(candidate.stripeSubscriptionId);
      if (!verified.cancel_at_period_end) {
        return failOperation(operation, "PARTIAL", Object.assign(new Error("Stripe did not confirm every scheduled cancellation."), { code: "STRIPE_NOT_VERIFIED" }));
      }
    }

    await prisma.roleTransitionOperation.update({
      where: { id: operation.id },
      data: { status: "STRIPE_VERIFIED" },
    });
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const current = await tx.user.findUnique({
          where: { id: operation.targetUserId },
          select: { role: true, roleVersion: true, deletedAt: true },
        });
        if (
          !current ||
          current.role !== operation.fromRole ||
          current.roleVersion !== operation.targetRoleVersion
        ) {
          throw Object.assign(new Error("The account role changed before this operation completed."), {
            code: "STALE_ROLE_VERSION",
          });
        }
        await assertRoleTransitionAllowed({
          actorId,
          target: { id: operation.targetUserId, ...current },
          toRole: operation.toRole,
          db: tx,
        });
        await tx.user.update({
          where: { id: operation.targetUserId },
          data: { role: operation.toRole, roleVersion: { increment: 1 } },
        });
        await syncEffectiveAccessPlans(operation.targetUserId, tx);
        const completed = await tx.roleTransitionOperation.update({
          where: { id: operation.id },
          data: {
            status: "COMPLETED",
            activeTargetKey: null,
            completedAt: new Date(),
            errorCode: null,
            errorMessage: null,
          },
        });
        if (roleTransitionRequiresCancellation(operation.toRole)) {
          await releaseBillingMutationFence(
            {
              userId: operation.targetUserId,
              operationKey: roleTransitionFenceKey(operation.id),
            },
            tx,
          );
        }
        await writeAudit(
          {
            actorId,
            action: "USER_ROLE_CHANGED",
            targetUserId: operation.targetUserId,
            meta: {
              operationId: operation.id,
              fromRole: operation.fromRole,
              toRole: operation.toRole,
              scheduledSubscriptionIds: operation.subscriptions.map(
                (item) => item.stripeSubscriptionId,
              ),
            },
          },
          tx,
        );
        return completed;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    return failOperation(
      operation,
      roleTransitionRequiresCancellation(operation.toRole)
        ? "STRIPE_VERIFIED"
        : "NEEDS_ATTENTION",
      error,
    );
  }
}
