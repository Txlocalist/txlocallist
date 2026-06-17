import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createBillingPortalSessionAction,
  createCheckoutSessionAction,
} from "@/app/actions/billing";
import { getCurrentSession } from "@/lib/auth/session";
import {
  formatPriceFromCents,
  formatSubscriptionStatus,
  getOwnerBillingState,
  syncSubscriptionFromCheckoutSessionId,
} from "@/lib/billing";
import { isMissingPrismaTableError, phase3SchemaMessage } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";

import { DashboardLayout } from "../DashboardShell";
import styles from "../dashboard.module.css";

function getNotice(params) {
  if (params.checkout === "success") {
    return {
      tone: "success",
      title: "Checkout complete",
      message:
        "Stripe returned successfully. Your paid account is syncing now and listing access will refresh here as soon as Stripe confirms the subscription.",
    };
  }

  if (params.checkout === "canceled") {
    return {
      tone: "warning",
      title: "Checkout canceled",
      message: "No charge was created. You can start checkout again whenever you're ready.",
    };
  }

  if (params.portal === "returned") {
    return {
      tone: "success",
      title: "Billing portal closed",
      message: "Any payment method, cancellation, or subscription changes from Stripe will show here after webhook sync completes.",
    };
  }

  const errorMessages = {
    checkout_unavailable:
      "Stripe Checkout is not ready yet. Confirm your Stripe secret key and plan price IDs are configured.",
    portal_unavailable:
      "The Stripe customer portal is unavailable for this account right now. Complete a paid checkout first, then try again.",
    manage_existing_subscription:
      "This account already has a Stripe subscription. Use the manage button instead of starting a second checkout.",
    schema_update_required:
      "The latest billing schema has not been applied to the database yet. Run the Prisma schema update, then try again.",
    missing_selection: "Choose a plan before starting checkout.",
    invalid_plan: "That plan cannot be purchased through billing.",
  };

  if (params.error && errorMessages[params.error]) {
    return {
      tone: "error",
      title: "Billing action failed",
      message: errorMessages[params.error],
    };
  }

  return null;
}

function getSubscriptionDetail(billingState) {
  if (!billingState?.stripeSubscriptionId) {
    return "No Stripe subscription yet.";
  }

  if (billingState.cancelAtPeriodEnd && billingState.currentPeriodEnd) {
    return `Cancels on ${new Date(billingState.currentPeriodEnd).toLocaleDateString()}.`;
  }

  if (billingState.currentPeriodEnd) {
    return `Renews on ${new Date(billingState.currentPeriodEnd).toLocaleDateString()}.`;
  }

  if (billingState.canceledAt) {
    return `Ended on ${new Date(billingState.canceledAt).toLocaleDateString()}.`;
  }

  return "Waiting for Stripe to send the next billing update.";
}

function getBillingStatusClass(tone) {
  switch (tone) {
    case "success":
      return styles.noticeSuccess;
    case "warning":
      return styles.noticeWarning;
    case "error":
    default:
      return styles.noticeError;
  }
}

export default async function BillingPage({ searchParams }) {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const stripeConfigured = isStripeConfigured();
  const notice = getNotice(params);

  if (stripeConfigured && params.checkout === "success" && params.session_id) {
    try {
      await syncSubscriptionFromCheckoutSessionId(params.session_id);
    } catch (error) {
      console.error("[billing] checkout session sync failed:", error);
    }
  }

  let billingState = null;
  let businesses = [];
  let plans = [];
  let schemaNotice = null;

  try {
    [billingState, businesses, plans] = await Promise.all([
      getOwnerBillingState(session.user.id),
      prisma.business.findMany({
        where: {
          ownerId: session.user.id,
        },
        include: {
          city: true,
          plan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.plan.findMany({
        where: {
          slug: {
            in: ["free", "starter"],
          },
        },
        orderBy: {
          tier: "asc",
        },
      }),
    ]);
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    schemaNotice = phase3SchemaMessage;
  }

  const paidPlan = plans.find((plan) => plan.slug === "starter") ?? null;
  const unconfiguredPlans = paidPlan && !paidPlan.stripePriceId ? [paidPlan] : [];
  const hasPaidAccess = Boolean(billingState?.hasPaidAccess);
  const hasCustomerPortalAccess = Boolean(billingState?.stripeCustomerId);
  const currentTierLabel = billingState?.activePlan?.name ?? "Free";
  const totalMonthlySpend = hasPaidAccess ? (billingState?.activePlan?.priceCents ?? 0) / 100 : 0;
  const canCreateListing = hasPaidAccess;

  return (
    <DashboardLayout activeTab="billing">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Billing & Subscriptions</h1>
          <p className={styles.pageSubtitle}>
            Listing creation is unlocked at the account level after you start the paid plan.
          </p>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Current Tier</h2>
            <p className={styles.cardContent}>
              {hasPaidAccess
                ? "Your paid account is active. You can create listings now and manage billing in Stripe at any time."
                : "This account is currently on the free tier. Upgrade first, then create and publish listings from your dashboard."}
            </p>
          </div>
          <div className={styles.billingTierPill}>{currentTierLabel}</div>
        </div>

        <div className={styles.billingHeroActions}>
          {hasPaidAccess && hasCustomerPortalAccess ? (
            <form action={createBillingPortalSessionAction} className={styles.inlineForm}>
              <button type="submit" className={styles.subscriptionAction}>
                Manage Or Downgrade
              </button>
            </form>
          ) : null}

          {!hasPaidAccess && paidPlan ? (
            <form action={createCheckoutSessionAction} className={styles.inlineForm}>
              <input type="hidden" name="planId" value={paidPlan.id} />
              <button
                type="submit"
                className={styles.subscriptionAction}
                disabled={!stripeConfigured || !paidPlan.stripePriceId}
              >
                Upgrade To {paidPlan.name}
              </button>
            </form>
          ) : null}

          {canCreateListing ? (
            <Link href="/dashboard/businesses/new" className={styles.subscriptionLinkAction}>
              Create Listing
            </Link>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className={`${styles.noticeBanner} ${getBillingStatusClass(notice.tone)}`}>
          <h2 className={styles.noticeTitle}>{notice.title}</h2>
          <p className={styles.noticeDescription}>{notice.message}</p>
        </div>
      ) : null}

      {schemaNotice ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Billing Data Unavailable</h2>
            <p className={styles.emptyStateDescription}>
              {schemaNotice} Apply the schema update and billing data will load here.
            </p>
          </div>
        </div>
      ) : null}

      {!stripeConfigured || unconfiguredPlans.length > 0 ? (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Stripe Setup</h2>
          <p className={styles.cardContent}>
            Billing buttons stay disabled until Stripe is fully configured for this environment.
          </p>
          <ul className={styles.billingChecklist}>
            {!stripeConfigured ? (
              <li>Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `.env`.</li>
            ) : null}
            {unconfiguredPlans.map((plan) => (
              <li key={plan.id}>Add a Stripe price ID for the {plan.name} plan and reseed plans.</li>
            ))}
            <li>Point Stripe webhooks to `/api/stripe/webhook`.</li>
            <li>Enable the Stripe customer portal in your Stripe dashboard.</li>
          </ul>
        </div>
      ) : null}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Current Spending</h2>
        <div className={styles.billingStats}>
          <div className={styles.billingStatItem}>
            <p className={styles.billingLabel}>Listings Created</p>
            <p className={styles.billingValue}>{businesses.length}</p>
          </div>
          <div className={styles.billingStatItem}>
            <p className={styles.billingLabel}>Monthly Recurring</p>
            <p className={styles.billingValue}>${totalMonthlySpend.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Account Subscription</h2>
          {hasPaidAccess && hasCustomerPortalAccess ? (
            <form action={createBillingPortalSessionAction} className={styles.inlineForm}>
              <button type="submit" className={styles.subscriptionAction}>
                Open Stripe Portal
              </button>
            </form>
          ) : null}
        </div>

        <div className={styles.subscriptionsList}>
          <div className={styles.subscriptionItem}>
            <div>
              <h3 className={styles.subscriptionName}>
                {hasPaidAccess ? billingState?.activePlan?.name ?? "Paid" : "Free"}
              </h3>
              <p className={styles.subscriptionMeta}>
                <strong>{formatSubscriptionStatus(billingState?.activeStatus)}</strong>
                {" - "}
                ${formatPriceFromCents(billingState?.activePlan?.priceCents ?? 0)}/
                {billingState?.activePlan?.billingPeriod ?? "monthly"}
              </p>
              <p className={styles.subscriptionDate}>{getSubscriptionDetail(billingState)}</p>
            </div>

            {!hasPaidAccess && paidPlan ? (
              <form action={createCheckoutSessionAction} className={styles.inlineForm}>
                <input type="hidden" name="planId" value={paidPlan.id} />
                <button
                  type="submit"
                  className={styles.subscriptionAction}
                  disabled={!stripeConfigured || !paidPlan.stripePriceId}
                >
                  Start Paid Plan
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      {businesses.length > 0 ? (
        <div className={styles.card} id="listing-billing">
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>My Listings</h2>
            {canCreateListing ? (
              <Link href="/dashboard/businesses/new" className={styles.subscriptionLinkAction}>
                Create Another Listing
              </Link>
            ) : null}
          </div>

          <div className={styles.billingListings}>
            {businesses.map((business) => (
              <article key={business.id} className={styles.billingListingCard}>
                <div className={styles.billingListingHeader}>
                  <div>
                    <h3 className={styles.billingListingTitle}>{business.name}</h3>
                    <p className={styles.billingListingMeta}>
                      {business.city?.name || "Texas"} • Current plan:{" "}
                      <strong>{business.plan?.name || "Free"}</strong>
                    </p>
                  </div>
                  <div className={styles.billingListingBadges}>
                    <span className={styles.billingTierPill}>{business.plan?.name || "Free"}</span>
                    <span className={styles.billingStatusPill}>{business.status}</span>
                  </div>
                </div>

                <p className={styles.billingListingDetail}>
                  Edit the listing details from the listings dashboard. Billing access for this listing
                  follows your account subscription.
                </p>

                <div className={styles.billingActionStack}>
                  <Link
                    href={`/dashboard/businesses/${business.id}/edit`}
                    className={styles.subscriptionLinkAction}
                  >
                    Edit Listing
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h3 className={styles.emptyStateTitle}>No listings yet</h3>
            <p className={styles.emptyStateDescription}>
              {canCreateListing
                ? "Your paid account is active. Create your first listing whenever you're ready."
                : "Upgrade your account first. Listing creation stays locked until the paid plan is active."}
            </p>
            <Link
              href={canCreateListing ? "/dashboard/businesses/new" : "/dashboard/billing"}
              className={styles.emptyStateAction}
            >
              {canCreateListing ? "Create Listing" : "Upgrade Account"}
            </Link>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Payment Methods</h2>
          {hasCustomerPortalAccess ? (
            <form action={createBillingPortalSessionAction} className={styles.inlineForm}>
              <button type="submit" className={styles.subscriptionAction}>
                Manage Payment Methods
              </button>
            </form>
          ) : null}
        </div>
        <p className={styles.cardContent}>
          Payment methods are managed in Stripe’s hosted portal after the first paid checkout
          creates a customer record for this account.
        </p>
      </div>

      <div className={styles.card} style={{ backgroundColor: "rgba(248, 237, 210, 0.2)" }}>
        <h3 className={styles.cardTitle}>Billing Information</h3>
        <ul className={styles.billingChecklist}>
          <li>Any signed-in user account can upgrade to the paid creator plan.</li>
          <li>Listing creation and publishing stay locked until the paid plan is active.</li>
          <li>Stripe webhooks keep local account access synchronized after renewals and cancellations.</li>
          <li>Cancel-at-period-end stays active locally until Stripe marks the subscription as ended.</li>
        </ul>
      </div>
    </DashboardLayout>
  );
}
