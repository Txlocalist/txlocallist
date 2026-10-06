import { redirect } from "next/navigation";
import { DashboardLayout } from "./DashboardShell";
import { OverviewContent } from "./OverviewContent";
import { getAccountAccess } from "@/lib/account-access";
import { getOwnedEventWhere } from "@/lib/listing-visibility";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

function titleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Main dashboard overview page.
 * Shows stats, recent listings, and quick actions.
 */
export default async function DashboardPage() {
  // Get current user from session
  const session = await getCurrentSession();

  if (!session || !session.user) {
    redirect("/login");
  }

  const user = session.user;

  const billingState = await getAccountAccess(user.id).catch(() => null);
  const canCreateListing = Boolean(billingState?.hasCreatorAccess);

  if (!canCreateListing) {
    redirect("/dashboard/favorites");
  }

  const [businessResult, eventResult] = await Promise.allSettled([
    prisma.business.findMany({
      where: { ownerId: user.id, deletedAt: null, status: { not: "ARCHIVED" } },
      include: {
        city: true,
        plan: true,
        subscription: true,
        photos: true,
        categories: { include: { category: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.findMany({
      where: getOwnedEventWhere(user.id),
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { business: { select: { status: true } } },
    }),
  ]);
  for (const result of [businessResult, eventResult]) {
    if (result.status === "rejected" && !isMissingPrismaTableError(result.reason)) {
      throw result.reason;
    }
  }
  const businesses = businessResult.status === "fulfilled" ? businessResult.value : [];
  const recentEvents = eventResult.status === "fulfilled" ? eventResult.value : [];
  const eventsUnavailable = eventResult.status === "rejected";

  const stats = {
    total: businesses.length,
    active: businesses.filter((b) => b.status === "ACTIVE").length,
    draft: businesses.filter((b) => b.status === "DRAFT").length,
    paused: businesses.filter((b) => b.status === "PAUSED").length,
    paidPlans: businesses.filter((b) => b.plan?.slug && b.plan.slug !== "free").length,
  };

  const recentBusinesses = businesses.slice(0, 5);
  const firstBusinessName = businesses[0]?.name ?? null;
  const firstNameFromEmail = user.email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "neighbor";
  const greetingName = firstBusinessName || titleCase(firstNameFromEmail);
  const subtitle =
    businesses.length > 0
      ? `Your profile is shining bright. You currently have ${stats.active} active listing${stats.active === 1 ? "" : "s"}, ${stats.draft} draft${stats.draft === 1 ? "" : "s"}, and ${stats.paidPlans} paid plan${stats.paidPlans === 1 ? "" : "s"} in motion.`
      : null;

  return (
    <DashboardLayout activeTab="overview">
      <OverviewContent
        canCreateListing={canCreateListing}
        greetingName={greetingName}
        recentBusinesses={recentBusinesses}
        recentEvents={recentEvents}
        eventsUnavailable={eventsUnavailable}
        stats={stats}
        subtitle={subtitle}
      />
    </DashboardLayout>
  );

}
