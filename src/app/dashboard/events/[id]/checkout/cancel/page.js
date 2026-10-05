import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { DashboardLayout } from "../../../../DashboardShell";
import styles from "../../../../dashboard.module.css";

export const metadata = {
  title: "Happening Checkout Closed | TX Localist",
};

export default async function EventCheckoutCancelPage({ params }) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/login?next=${encodeURIComponent(`/dashboard/events/${id}/checkout/cancel`)}`);

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, title: true, creatorId: true, status: true },
  });
  if (!event || event.creatorId !== session.user.id) notFound();
  const checkoutMessage = event.status !== "DRAFT"
    ? "Stripe has already updated this happening. Return to My Happenings for its current status."
    : `${event.title} remains saved as a private draft. New happenings must be posted through an active business membership.`;

  return (
    <DashboardLayout activeTab="events-live">
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <h1 className={styles.emptyStateTitle}>Checkout Closed</h1>
          <p className={styles.emptyStateDescription}>
            {checkoutMessage}
          </p>
          <Link href="/dashboard/events" className={styles.actionButton}>Back to My Happenings</Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
