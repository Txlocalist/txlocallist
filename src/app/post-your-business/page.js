import Link from "next/link";
import { Navbar, Footer } from "@/components";
import { getCurrentUser } from "@/lib/auth/session";
import styles from "./post.module.css";

export const metadata = {
  title: "Post Your Business | TX Localist",
  description:
    "Get your Texas business listed in the most trusted local directory. Month-to-month, no contracts.",
};

const STEPS = [
  {
    number: "01",
    title: "Create Your Account",
    description: "Create a normal user account so you can browse, save favorites, and manage billing in one place.",
  },
  {
    number: "02",
    title: "Start The Paid Plan",
    description: "Unlock listing access with one simple $20 monthly subscription through Stripe.",
  },
  {
    number: "03",
    title: "Build Your Listing",
    description: "Add your business name, description, contact info, photos, and categories.",
  },
  {
    number: "04",
    title: "Go Live",
    description: "Publish your listing and start appearing in local search results instantly.",
  },
];

const BENEFITS = [
  { icon: "📍", title: "Local Visibility", description: "Appear in city and keyword searches across Texas." },
  { icon: "📞", title: "Direct Contact", description: "Let customers reach you directly — no middleman." },
  { icon: "📸", title: "Photo Gallery", description: "Showcase your space, products, or team with photos." },
  { icon: "💼", title: "Job Postings", description: "Post open positions and find local talent fast." },
  { icon: "🔗", title: "Website & Socials", description: "Link your website and social profiles to your listing." },
  { icon: "⭐", title: "Featured Placement", description: "Paid listings earn stronger placement in local search." },
];

export default async function PostYourBusinessPage() {
  const user = await getCurrentUser();
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>TX Localist // List Your Business</p>
          <h1 className={styles.heroTitle}>
            Get Found by<br />Texas Locals
          </h1>
          <p className={styles.heroSubtitle}>
            The no-nonsense Texas business directory. Month-to-month plans,
            no long-term contracts, cancel any time.
          </p>
          <div className={styles.heroActions}>
            <Link
              href={user ? "/dashboard/billing" : "/signup?intent=owner"}
              className={styles.heroCta}
            >
              {user ? "Upgrade To Post →" : "Create Account →"}
            </Link>
            <Link href="/pricing" className={styles.heroSecondary}>
              View Plans & Pricing
            </Link>
          </div>
          <p className={styles.heroNote}>
            $20/month paid plan required before listing creation
          </p>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className={styles.benefitsSection}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Everything You Need to Get Found</h2>
          <div className={styles.benefitsGrid}>
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className={styles.benefitCard}>
                <span className={styles.benefitIcon}>{benefit.icon}</span>
                <h3 className={styles.benefitTitle}>{benefit.title}</h3>
                <p className={styles.benefitDescription}>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.stepsSection}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <div className={styles.stepsGrid}>
            {STEPS.map((step) => (
              <div key={step.number} className={styles.stepCard}>
                <span className={styles.stepNumber}>{step.number}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDescription}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Tease */}
      <section className={styles.pricingTease}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Simple, Honest Pricing</h2>
          <p className={styles.sectionSubtitle}>
            Month-to-month. No setup fees. No cancellation penalties.
          </p>
          <div className={styles.teaseGrid}>
            <div className={styles.teaseCard}>
              <p className={styles.teasePlan}>Free</p>
              <p className={styles.teasePrice}>$0<span>/mo</span></p>
              <p className={styles.teaseDesc}>Name in the directory. Great for getting started.</p>
            </div>
            <div className={`${styles.teaseCard} ${styles.teaseCardHighlight}`}>
              <p className={styles.teasePlan}>Paid</p>
              <p className={styles.teasePrice}>$20<span>/mo</span></p>
              <p className={styles.teaseDesc}>Contact info, socials, featured placement, more photos, and job postings.</p>
            </div>
          </div>
          <Link href="/pricing" className={styles.teaseLink}>
            See Full Feature Comparison →
          </Link>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.sectionInner}>
          <h2 className={styles.ctaTitle}>Ready to Get Listed?</h2>
          <p className={styles.ctaSubtitle}>
            Join hundreds of Texas businesses already on TX Localist.
          </p>
          <Link
            href={user ? "/dashboard/billing" : "/signup?intent=owner"}
            className={styles.heroCta}
          >
            {user ? "Upgrade To Post →" : "Create Your Account →"}
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
