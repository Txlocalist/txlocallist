import Image from "next/image";
import Link from "next/link";

import danceHallImage from "@/app/assets/texas-dance-hall.webp";
import { Footer, Navbar } from "@/components";
import PricingComparison from "@/components/PricingComparison/PricingComparison";
import {
  EVENT_MAX_CALENDAR_DAYS,
  EVENT_POST_CHECKOUT_DISCLOSURE,
  EVENT_POST_PRICE_CENTS,
  MEMBERSHIP_PRICE_CENTS,
  formatWholeDollarPrice,
} from "@/lib/pricing";

import styles from "./pricing.module.css";

const MEMBERSHIP_PRICE = formatWholeDollarPrice(MEMBERSHIP_PRICE_CENTS);
const EVENT_POST_PRICE = formatWholeDollarPrice(EVENT_POST_PRICE_CENTS);

export const metadata = {
  title: "Pricing | TX Localist",
  description: `Browse TX Localist for free, publish a local business for ${MEMBERSHIP_PRICE} a month, or post one calendar event for ${EVENT_POST_PRICE}.`,
};

const FAQ = [
  {
    question: "When does the business membership renew?",
    answer:
      "It renews monthly on the date you start. Cancel before your next renewal date to prevent another charge.",
  },
  {
    question: "Do I need a business membership to post an event?",
    answer:
      `No. Any signed-in organizer can submit one event and pay the one-time ${EVENT_POST_PRICE} posting fee.`,
  },
  {
    question: "How long can one event post run?",
    answer:
      `One post can cover 1-${EVENT_MAX_CALENDAR_DAYS} consecutive calendar days. A one-day event and a multi-day event each cost ${EVENT_POST_PRICE}.`,
  },
  {
    question: "When is the event fee refunded?",
    answer: EVENT_POST_CHECKOUT_DISCLOSURE,
  },
  {
    question: "What happens if I edit a published event?",
    answer:
      "Material changes return the event to review. Date corrections must stay inside the originally purchased range; moving or extending the event requires a new post.",
  },
  {
    question: "What happens to an approved event if my membership ends?",
    answer:
      "An approved business-linked event stays published through its scheduled end. New submissions require an active membership or a separate one-time event post.",
  },
];

export default function PricingPage() {
  return (
    <div className={styles.pageShell}>
      <Navbar activeHref="/pricing" />

      <main className={styles.page}>
        <section className={styles.header} aria-labelledby="pricing-page-title">
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>TX Localist // Pricing</p>
            <h1 id="pricing-page-title" className={styles.title}>
              Simple pricing for local reach.
            </h1>
            <p className={styles.subtitle}>
              Join for {MEMBERSHIP_PRICE} monthly, or pay {EVENT_POST_PRICE} once to place one
              event on the calendar.
            </p>
          </div>

          <div className={styles.headerMedia}>
            <Image
              src={danceHallImage}
              alt="A Texas dance hall glowing at dusk"
              fill
              priority
              sizes="(max-width: 767px) calc(100vw - 64px), 430px"
              className={styles.headerImage}
            />
          </div>
        </section>

        <PricingComparison />

        <section className={styles.faqSection} aria-labelledby="pricing-faq-title">
          <div className={styles.faqHeader}>
            <h2 id="pricing-faq-title" className={styles.faqTitle}>
              Before you choose
            </h2>
            <p className={styles.faqIntro}>
              The monthly membership and one-time event fee are separate products with separate
              benefits.
            </p>
          </div>

          <dl className={styles.faqGrid}>
            {FAQ.map((item) => (
              <div key={item.question} className={styles.faqItem}>
                <dt className={styles.faqQuestion}>{item.question}</dt>
                <dd className={styles.faqAnswer}>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.ctaSection} aria-labelledby="pricing-cta-title">
          <div className={styles.ctaCard}>
            <div className={styles.ctaCopy}>
              <h2 id="pricing-cta-title" className={styles.ctaTitle}>
                Ready to be found?
              </h2>
              <p className={styles.ctaText}>
                Add your business for ongoing visibility, or submit one event for the community
                calendar.
              </p>
            </div>

            <div className={styles.ctaActions}>
              <Link href="/post-your-business" className={styles.ctaButton}>
                List Your Business
              </Link>
              <Link href="/post-an-event" className={styles.ctaButtonSecondary}>
                Post an Event
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer compact />
    </div>
  );
}
