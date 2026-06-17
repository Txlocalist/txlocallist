"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  getBillingPath,
  getOwnerBillingState,
} from "@/lib/billing";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";

function redirectToBilling(params = {}) {
  redirect(getBillingPath(params));
}

async function requireBillingUserContext() {
  const sessionUser = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      stripeCustomerId: true,
    },
  }).catch((error) => {
    if (isMissingPrismaTableError(error)) {
      redirectToBilling({ error: "schema_update_required" });
    }

    throw error;
  });

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function createCheckoutSessionAction(formData) {
  const user = await requireBillingUserContext();
  const planId = formData.get("planId")?.toString().trim();

  if (!planId) {
    redirectToBilling({ error: "missing_selection" });
  }

  const [billingState, plan] = await Promise.all([
    getOwnerBillingState(user.id),
    prisma.plan.findUnique({
      where: { id: planId },
    }),
  ]).catch((error) => {
    if (isMissingPrismaTableError(error)) {
      redirectToBilling({ error: "schema_update_required" });
    }

    throw error;
  });

  if (!plan || plan.slug !== "starter") {
    redirectToBilling({ error: "invalid_plan" });
  }

  if (!billingState) {
    redirect("/login");
  }

  if (billingState.hasPaidAccess || billingState.stripeSubscriptionId) {
    redirectToBilling({ error: "manage_existing_subscription" });
  }

  try {
    const session = await createStripeCheckoutSession({
      user,
      plan,
    });

    if (!session.url) {
      throw new Error("Stripe Checkout did not return a redirect URL.");
    }

    redirect(session.url);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("[billing] checkout session failed:", error);
    redirectToBilling({ error: "checkout_unavailable" });
  }
}

export async function createBillingPortalSessionAction(formData) {
  const user = await requireBillingUserContext();
  const businessId = formData.get("businessId")?.toString().trim();

  if (businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        ownerId: true,
      },
    }).catch((error) => {
      if (isMissingPrismaTableError(error)) {
        redirectToBilling({ error: "schema_update_required" });
      }

      throw error;
    });

    if (!business || business.ownerId !== user.id) {
      redirectToBilling({ error: "listing_not_found" });
    }
  }

  try {
    const session = await createStripePortalSession({ user });

    if (!session.url) {
      throw new Error("Stripe Billing Portal did not return a redirect URL.");
    }

    redirect(session.url);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("[billing] portal session failed:", error);
    redirectToBilling({ error: "portal_unavailable" });
  }
}
