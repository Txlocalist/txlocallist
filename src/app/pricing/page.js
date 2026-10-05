import { Footer, Navbar } from "@/components";
import PricingCards from "@/components/PricingCards/PricingCards";
import {
  MEMBERSHIP_PRICE_CENTS,
  formatWholeDollarPrice,
} from "@/lib/pricing";

import styles from "./pricing.module.css";

const membershipPrice = formatWholeDollarPrice(MEMBERSHIP_PRICE_CENTS);

export const metadata = {
  title: "Pricing | TX Localist",
  description: `Browse TX Localist for free or list a business for ${membershipPrice} a month. Keep it Real. Keep it Local. Keep it Texas.`,
};

export default function PricingPage() {
  return (
    <div className={styles.pageShell}>
      <Navbar activeHref="/pricing" />

      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>TX Localist // Pricing</p>
          <h1>Keep it Real. Keep it Local. Keep it Texas.</h1>
        </header>

        <section aria-label="TX Localist plans">
          <PricingCards />
        </section>

        <section className={styles.note} aria-labelledby="pricing-note-title">
          <h2 id="pricing-note-title">A clear, local-first approach</h2>
          <p>
            Business memberships are month to month.
          </p>
        </section>
      </main>

      <Footer compact />
    </div>
  );
}
