import { prisma } from "@/lib/prisma";
import {
  syncEffectiveAccessPlans,
} from "@/lib/account-access";
import {
  acquireBillingMutationFence,
  attachStripeSessionToFence,
  BILLING_MUTATION_KIND,
  checkoutFenceExpiresAt,
  MEMBERSHIP_CHECKOUT_SECONDS,
  newBillingMutationKey,
  portalFenceExpiresAt,
  releaseBillingMutationFence,
  releaseFenceFromStripeSession,
} from "@/lib/billing-mutation-fence";
import {
  MEMBERSHIP_PRICE_CATALOG_KEY,
  MEMBERSHIP_PRODUCT_CATALOG_KEY,
  retrieveAndValidateStripePrice,
} from "@/lib/pricing";
import { getRuntimeEnvironment } from "@/lib/runtime-config.mjs";
import { getSiteUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  getStripePriceIdFromSubscription,
  getStripeProductIdFromSubscription,
  isCompatibleStarterPlan,
  isCompatibleStarterPrice,
  isCompatibleStarterSubscriptionPrice,
} from "@/lib/stripe-subscription-price";
import { getStripeSubscriptionPeriodEnd } from "@/lib/subscription-period";

export { getStripeSubscriptionPeriodEnd } from "@/lib/subscription-period";

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["ACTIVE", "TRIALING"]);
export const FEATURE_ACCESS_SUBSCRIPTION_STATUSES = new Set([
  "ACTIVE",
  "TRIALING",
]);

const STRIPE_STATUS_TO_LOCAL_STATUS = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "UNPAID",
  incomplete: "INCOMPLETE",
  incomplete_expired: "EXPIRED",
  paused: "PAUSED",
};

export function formatPriceFromCents(priceCents) {
  return (priceCents / 100).toFixed(2);
}

export function isSubscriptionActive(status) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

export function hasSubscriptionFeatureAccess(status) {
  return FEATURE_ACCESS_SUBSCRIPTION_STATUSES.has(status);
}

export function formatSubscriptionStatus(status) {
  return (status ?? "FREE")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getBillingPath(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `/dashboard/billing?${query}` : "/dashboard/billing";
}

function mapStripeSubscriptionStatus(status) {
  return STRIPE_STATUS_TO_LOCAL_STATUS[status] ?? "INCOMPLETE";
}

async function getFreePlan() {
  const freePlan = await prisma.plan.findUnique({
    where: { slug: "free" },
    select: {
      id: true,
      name: true,
      slug: true,
      priceCents: true,
      billingPeriod: true,
    },
  });

  if (!freePlan) {
    throw new Error("The free plan is missing.");
  }

  return freePlan;
}

async function getFreePlanId() {
  const freePlan = await getFreePlan();
  return freePlan.id;
}

export function isSandboxStripeCustomerRepairAllowed(env = process.env) {
  return Boolean(
    getRuntimeEnvironment(env) !== "production" &&
    env.STRIPE_SECRET_KEY?.trim().startsWith("sk_test_")
  );
}

export async function ensureStripeCustomerForUser(user) {
  const stripe = getStripe();

  if (user.stripeCustomerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(user.stripeCustomerId);

      if (!existingCustomer.deleted) {
        const metadataUserId = existingCustomer.metadata?.userId;
        if (metadataUserId && metadataUserId !== user.id) {
          throw new Error("The stored Stripe customer belongs to another account.");
        }

        return existingCustomer.id;
      }

      if (!isSandboxStripeCustomerRepairAllowed()) {
        throw new Error("The stored Stripe customer has been deleted.");
      }
    } catch (error) {
      // A Customer ID is scoped to one Stripe account and mode. Development
      // databases can retain a test Customer from a replaced sandbox. Repair
      // only Stripe's explicit missing-resource response; every other error is
      // surfaced so an outage or ownership problem cannot create duplicates.
      if (
        error?.code !== "resource_missing" ||
        !isSandboxStripeCustomerRepairAllowed()
      ) {
        throw error;
      }
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: {
      userId: user.id,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customer.id,
    },
  });

  return customer.id;
}

async function syncUserStripeCustomer(customerId, ownerId) {
  if (!customerId || !ownerId) {
    return;
  }

  await prisma.user.updateMany({
    where: {
      id: ownerId,
      OR: [{ stripeCustomerId: null }, { stripeCustomerId: customerId }],
    },
    data: {
      stripeCustomerId: customerId,
    },
  });
}

export async function createStripeCheckoutSession({ user, plan }) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  if (!plan.stripePriceId) {
    throw new Error(`${plan.name} does not have a Stripe price ID configured.`);
  }

  await retrieveAndValidateStripePrice({
    priceId: plan.stripePriceId,
    amountCents: plan.priceCents,
    recurring: true,
    recurringInterval: "month",
    recurringIntervalCount: 1,
    priceCatalogKey: MEMBERSHIP_PRICE_CATALOG_KEY,
    productCatalogKey: MEMBERSHIP_PRODUCT_CATALOG_KEY,
  });

  const stripe = getStripe();
  const siteUrl = getSiteUrl();
  const operationKey = newBillingMutationKey("subscription-checkout");
  const checkoutExpiresAt = Math.floor(Date.now() / 1000) + MEMBERSHIP_CHECKOUT_SECONDS;
  const fenceExpiresAt = checkoutFenceExpiresAt(checkoutExpiresAt);

  await prisma.$transaction((tx) => acquireBillingMutationFence(
    {
      userId: user.id,
      kind: BILLING_MUTATION_KIND.CHECKOUT,
      operationKey,
      expiresAt: fenceExpiresAt,
    },
    tx,
  ));

  let session = null;
  try {
    const customerId = await ensureStripeCustomerForUser(user);
    session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.id,
        success_url: `${siteUrl}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/dashboard/billing?checkout=canceled`,
        expires_at: checkoutExpiresAt,
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        metadata: {
          ownerId: user.id,
          planId: plan.id,
          scope: "account",
          billingMutationKey: operationKey,
        },
        subscription_data: {
          metadata: {
            ownerId: user.id,
            planId: plan.id,
            scope: "account",
            billingMutationKey: operationKey,
          },
        },
      },
      { idempotencyKey: operationKey },
    );

    await attachStripeSessionToFence({
      userId: user.id,
      operationKey,
      stripeSessionId: session.id,
      expiresAt: checkoutFenceExpiresAt(session.expires_at ?? checkoutExpiresAt),
    });
    return session;
  } catch (error) {
    if (!session) {
      await releaseBillingMutationFence({ userId: user.id, operationKey })
        .catch(() => null);
    } else {
      const expired = await stripe.checkout.sessions.expire(session.id)
        .then(() => true)
        .catch(() => false);
      if (expired) {
        await releaseBillingMutationFence({ userId: user.id, operationKey })
          .catch(() => null);
      }
    }
    throw error;
  }
}

export async function createStripePortalSession({ user }) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  if (user.role === "COMPLIMENTARY") {
    throw new Error("Subscription management is disabled while Complimentary access is active.");
  }

  const customerId =
    user.stripeCustomerId ||
    (
      await prisma.subscription.findFirst({
        where: {
          business: {
            ownerId: user.id,
          },
          stripeCustomerId: {
            not: null,
          },
        },
        select: {
          stripeCustomerId: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      })
    )?.stripeCustomerId;

  if (!customerId) {
    throw new Error("No Stripe customer exists for this account yet.");
  }

  const operationKey = newBillingMutationKey("billing-portal");
  await prisma.$transaction((tx) => acquireBillingMutationFence(
    {
      userId: user.id,
      kind: BILLING_MUTATION_KIND.PORTAL,
      operationKey,
      expiresAt: portalFenceExpiresAt(),
    },
    tx,
  ));

  try {
    await syncUserStripeCustomer(customerId, user.id);
    return await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getSiteUrl()}${getBillingPath({ portal: "returned" })}`,
    });
  } finally {
    // Portal sessions can only mutate existing subscriptions. Holding the fence
    // through session creation prevents a new portal from opening during a role
    // transition; subscription webhooks enforce cancellation for any later
    // portal change after Complimentary access becomes active.
    await releaseBillingMutationFence({ userId: user.id, operationKey })
      .catch(() => null);
  }
}

export async function findPlanForStripeSubscription(stripeSubscription, stripePriceId) {
  // Never let an exact local Price ID bypass the paid Starter contract. This
  // is especially important when the membership Product also has a $0 Price.
  if (!isCompatibleStarterSubscriptionPrice(stripeSubscription)) return null;

  const exactPlan = await prisma.plan.findFirst({
    where: { stripePriceId },
    select: {
      id: true,
      slug: true,
      priceCents: true,
      billingPeriod: true,
    },
  });
  if (exactPlan) {
    return isCompatibleStarterPlan(exactPlan) ? { id: exactPlan.id } : null;
  }

  // Historical $10/month Prices on the same membership Product may continue
  // renewing after a catalog Price replacement. Never use this fallback for a
  // free, annual, or otherwise incompatible Price on that Product.
  const incomingProductId = getStripeProductIdFromSubscription(stripeSubscription);
  if (!incomingProductId || !isStripeConfigured()) return null;

  const starterPlan = await prisma.plan.findUnique({
    where: { slug: "starter" },
    select: {
      id: true,
      slug: true,
      stripePriceId: true,
      priceCents: true,
      billingPeriod: true,
    },
  });
  if (!starterPlan?.stripePriceId || !isCompatibleStarterPlan(starterPlan)) return null;

  const configuredPrice = await getStripe().prices.retrieve(starterPlan.stripePriceId);
  if (!isCompatibleStarterPrice(configuredPrice)) return null;
  const configuredProductId = typeof configuredPrice.product === "string"
    ? configuredPrice.product
    : configuredPrice.product?.id;

  return configuredProductId === incomingProductId
    ? { id: starterPlan.id }
    : null;
}

async function upsertSubscriptionFromStripeSubscription(stripeSubscription) {
  const businessId = stripeSubscription.metadata?.businessId;
  const ownerId = stripeSubscription.metadata?.ownerId;
  const stripePriceId = getStripePriceIdFromSubscription(stripeSubscription);

  if (!stripePriceId) {
    return false;
  }

  const [business, plan, freePlanId] = await Promise.all([
    businessId
      ? prisma.business.findUnique({
          where: { id: businessId },
          select: {
            id: true,
            ownerId: true,
          },
        })
      : Promise.resolve(null),
    findPlanForStripeSubscription(stripeSubscription, stripePriceId),
    getFreePlanId(),
  ]);

  if (!plan) {
    return false;
  }

  const localStatus = mapStripeSubscriptionStatus(stripeSubscription.status);
  const currentPeriodEnd = getStripeSubscriptionPeriodEnd(stripeSubscription);
  const canceledAt = stripeSubscription.canceled_at
    ? new Date(stripeSubscription.canceled_at * 1000)
    : null;
  const effectiveOwnerId = ownerId ?? business?.ownerId ?? null;
  const isAccountSubscription =
    stripeSubscription.metadata?.scope === "account" || !businessId;
  const stripeCustomerId = typeof stripeSubscription.customer === "string"
    ? stripeSubscription.customer
    : stripeSubscription.customer?.id ?? null;

  await prisma.$transaction(async (tx) => {
    if (business) {
      await tx.subscription.upsert({
        where: {
          businessId: business.id,
        },
        update: {
          planId: plan.id,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          status: localStatus,
          currentPeriodEnd,
          cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
          canceledAt,
        },
        create: {
          businessId: business.id,
          planId: plan.id,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          status: localStatus,
          currentPeriodEnd,
          cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
          canceledAt,
        },
      });
    }

    if (effectiveOwnerId && isAccountSubscription) {
      await tx.user.update({
        where: { id: effectiveOwnerId },
        data: {
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          accountPlanId: plan.id,
          billingStatus: localStatus,
          currentPeriodEnd,
          cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
          canceledAt,
        },
      });

    }

    if (effectiveOwnerId) {
      await syncEffectiveAccessPlans(effectiveOwnerId, tx);
    } else if (business) {
      await tx.business.update({
        where: { id: business.id },
        data: {
          planId: hasSubscriptionFeatureAccess(localStatus) ? plan.id : freePlanId,
        },
      });
    }
  });

  if (effectiveOwnerId) {
    await syncUserStripeCustomer(stripeCustomerId, effectiveOwnerId);
  }

  return true;
}

export async function syncStripeSubscriptionObject(stripeSubscription) {
  return upsertSubscriptionFromStripeSubscription(stripeSubscription);
}

const RENEWAL_CAPABLE_STRIPE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
  "paused",
]);

async function enforceComplimentaryCancellation(stripeSubscription, enforcementKey) {
  if (
    !RENEWAL_CAPABLE_STRIPE_STATUSES.has(stripeSubscription.status) ||
    stripeSubscription.cancel_at_period_end
  ) {
    return false;
  }

  const metadataOwnerId = stripeSubscription.metadata?.ownerId;
  const linkedUser = await prisma.user.findFirst({
    where: {
      AND: [
        {
          OR: [{ role: "COMPLIMENTARY" }, { deletedAt: { not: null } }],
        },
        {
          OR: [
            ...(metadataOwnerId ? [{ id: metadataOwnerId }] : []),
            { stripeSubscriptionId: stripeSubscription.id },
            {
              ownedBusinesses: {
                some: {
                  subscription: { is: { stripeSubscriptionId: stripeSubscription.id } },
                },
              },
            },
          ],
        },
      ],
    },
    select: { id: true, deletedAt: true },
  });

  if (!linkedUser) return false;

  const updated = await getStripe().subscriptions.update(
    stripeSubscription.id,
    {
      cancel_at_period_end: true,
      proration_behavior: "none",
    },
    {
      idempotencyKey: `complimentary-enforce:${linkedUser.id}:${stripeSubscription.id}:${enforcementKey}`,
    },
  );
  await upsertSubscriptionFromStripeSubscription(updated);
  await prisma.auditLog.create({
    data: {
      actorId: null,
      action: linkedUser.deletedAt
        ? "DELETED_ACCOUNT_RENEWAL_RESCHEDULED"
        : "COMPLIMENTARY_RENEWAL_RESCHEDULED",
      entity: "User",
      entityId: linkedUser.id,
      meta: JSON.stringify({ stripeSubscriptionId: stripeSubscription.id }),
    },
  });
  return true;
}

export async function syncSubscriptionFromStripeSubscriptionId(
  subscriptionId,
  { enforcementKey = `reconcile-${Math.floor(Date.now() / 3_600_000)}` } = {},
) {
  if (!subscriptionId || !isStripeConfigured()) {
    return false;
  }

  const stripe = getStripe();
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const synced = await upsertSubscriptionFromStripeSubscription(stripeSubscription);
  if (synced) {
    await enforceComplimentaryCancellation(stripeSubscription, enforcementKey);
  }
  return synced;
}

export async function syncSubscriptionFromCheckoutSessionId(sessionId, expectedOwnerId = null) {
  if (!sessionId || !isStripeConfigured()) {
    return false;
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  const ownerId = session.metadata?.ownerId;
  if (
    session.mode !== "subscription" ||
    session.metadata?.scope !== "account" ||
    !ownerId ||
    session.client_reference_id !== ownerId ||
    (expectedOwnerId && expectedOwnerId !== ownerId)
  ) {
    return false;
  }

  if (session.customer) {
    await syncUserStripeCustomer(session.customer, ownerId);
  }

  if (!session.subscription) {
    return false;
  }

  const synced = typeof session.subscription === "string"
    ? await syncSubscriptionFromStripeSubscriptionId(session.subscription)
    : await upsertSubscriptionFromStripeSubscription(session.subscription);

  if (synced) await releaseFenceFromStripeSession(session);
  return synced;
}

export async function handleStripeSubscriptionWebhook(stripeSubscription, eventId = "webhook") {
  const synced = await syncSubscriptionFromStripeSubscriptionId(stripeSubscription.id, {
    enforcementKey: eventId,
  });
  if (synced && stripeSubscription.metadata?.ownerId && stripeSubscription.metadata?.billingMutationKey) {
    await releaseBillingMutationFence({
      userId: stripeSubscription.metadata.ownerId,
      operationKey: stripeSubscription.metadata.billingMutationKey,
    });
  }
  return synced;
}

export async function releaseAccountCheckoutFence(session) {
  if (session?.metadata?.scope !== "account") return false;
  return releaseFenceFromStripeSession(session);
}

export async function reconcileStripeSubscriptions({ limit = 100 } = {}) {
  const [accountSubscriptions, legacySubscriptions] = await Promise.all([
    prisma.user.findMany({
      where: { stripeSubscriptionId: { not: null } },
      select: { stripeSubscriptionId: true },
      take: limit,
    }),
    prisma.subscription.findMany({
      where: { stripeSubscriptionId: { not: null } },
      select: { stripeSubscriptionId: true },
      take: limit,
    }),
  ]);
  const subscriptionIds = Array.from(new Set(
    [...accountSubscriptions, ...legacySubscriptions]
      .map((item) => item.stripeSubscriptionId)
      .filter(Boolean),
  )).slice(0, limit);
  const results = { checked: subscriptionIds.length, synced: 0, failed: 0 };

  for (const subscriptionId of subscriptionIds) {
    try {
      const synced = await syncSubscriptionFromStripeSubscriptionId(subscriptionId);
      if (synced) results.synced += 1;
      else results.failed += 1;
    } catch (error) {
      results.failed += 1;
      console.error(`[billing] reconciliation failed for ${subscriptionId}:`, error);
    }
  }

  return results;
}
