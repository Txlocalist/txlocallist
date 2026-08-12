import { Footer, Navbar } from "@/components";
import PricingCards from "@/components/PricingCards/PricingCards";
import {
  EVENT_POST_CHECKOUT_DISCLOSURE,
  EVENT_POST_PRICE_CENTS,
  MEMBERSHIP_PRICE_CENTS,
  formatWholeDollarPrice,
} from "@/lib/pricing";

import styles from "./pricing.module.css";

const membershipPrice = formatWholeDollarPrice(MEMBERSHIP_PRICE_CENTS);
const eventPostPrice = formatWholeDollarPrice(EVENT_POST_PRICE_CENTS);

export const metadata = {
  title: "Pricing | TX Localist",
  description: `Browse TX Localist for free, list a business for ${membershipPrice} a month, or post one calendar event for ${eventPostPrice}.`,
};

export default function PricingPage() {
  return (
    <div className={styles.pageShell}>
      <Navbar activeHref="/pricing" />

      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>TX Localist // Pricing</p>
          <h1>Simple pricing for showing up locally.</h1>
          <p>
            Browse for free, build a local presence with a business membership, or add one event
            to the Texas calendar.
          </p>
        </header>

        <section aria-label="TX Localist plans">
          <PricingCards />
        </section>

        <section className={styles.note} aria-labelledby="pricing-note-title">
          <h2 id="pricing-note-title">A clear, local-first approach</h2>
          <p>
            Business memberships are month to month. Event posts are a separate, one-time charge.
            {" "}{EVENT_POST_CHECKOUT_DISCLOSURE}
          </p>
        </section>
      </main>

      <Footer compact />
    </div>
  );
}
