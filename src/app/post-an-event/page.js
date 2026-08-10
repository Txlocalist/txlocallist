import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import {
  EVENT_MAX_CALENDAR_DAYS,
  EVENT_POST_REFUND_DISCLOSURE,
  EVENT_POST_REVIEW_DISCLOSURE,
  EVENT_POST_TAX_DISCLOSURE,
  EVENT_POST_PRICE_CENTS,
  formatWholeDollarPrice,
  isEventPostingEnabled,
} from "@/lib/pricing";
import { Footer, Navbar } from "@/components";

import styles from "./post-an-event.module.css";

const EVENT_POST_PRICE = formatWholeDollarPrice(EVENT_POST_PRICE_CENTS);

export const metadata = {
  title: "Post an Event | TX Localist",
  description: `Add one local event to the TX Localist calendar for a ${EVENT_POST_PRICE} one-time fee.`,
};

export default async function PostAnEventPage() {
  const user = await getCurrentUser();
  const postingEnabled = isEventPostingEnabled();
  const actionHref = user
    ? "/dashboard/events/new"
    : "/signup?next=/dashboard/events/new";

  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Texas events calendar</p>
            <h1>Put your event on the local calendar.</h1>
            <p className={styles.lede}>
              One payment covers one continuous event, whether it lasts one day or several.
            </p>
            <div className={styles.actions}>
              {postingEnabled ? (
                <Link href={actionHref} className={styles.primaryAction}>Post an Event</Link>
              ) : (
                <span className={styles.primaryAction} aria-disabled="true">
                  Checkout Opening Soon
                </span>
              )}
              <Link href="/pricing" className={styles.secondaryAction}>View Pricing</Link>
            </div>
          </div>

          <aside className={styles.priceBlock} aria-label="Event post price">
            <p className={styles.price}>{EVENT_POST_PRICE}</p>
            <p className={styles.priceLabel}>one time per event</p>
            <p className={styles.priceDetail}>
              Covers 1-{EVENT_MAX_CALENDAR_DAYS} consecutive calendar days.
            </p>
            <p className={styles.priceDetail}>{EVENT_POST_TAX_DISCLOSURE}</p>
          </aside>
        </section>

        <section className={styles.details}>
          <div>
            <h2>Submit, pay, then review</h2>
            <p>{EVENT_POST_REVIEW_DISCLOSURE}</p>
          </div>
          <div>
            <h2>One event per purchase</h2>
            <p>Recurring dates and separate occurrences need separate event posts.</p>
          </div>
          <div>
            <h2>Clear refund policy</h2>
            <p>
              {EVENT_POST_REFUND_DISCLOSURE} <Link href="/terms">Review the event payment terms.</Link>
            </p>
          </div>
          <div>
            <h2>Membership option</h2>
            <p>Active business members can link an owned listing and submit events without the one-time charge.</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
