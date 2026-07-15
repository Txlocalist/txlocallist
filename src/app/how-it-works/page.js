import Image from "next/image";
import Link from "next/link";

import heroImage from "@/app/assets/hero-how-it-works.webp";
import bluebonnetImage from "@/app/assets/how-it-works (1).webp";
import gasStationImage from "@/app/assets/how-it-works (3).webp";
import longhornImage from "@/app/assets/Longhorn-white.webp";
import { Footer, Navbar } from "@/components";

import styles from "./how-it-works.module.css";

export const metadata = {
  title: "How It Works | TX Localist",
  description: "See how locals browse TX Localist and how business owners get listed.",
};

const LOCAL_STEPS = [
  {
    icon: "search",
    copy: "Search by city, category, or keyword to narrow the field fast.",
  },
  {
    icon: "storefront",
    copy: "Open any listing to see the description, location, photos, categories, and business hours.",
  },
  {
    icon: "favorite_border",
    copy: "Save your favorites to your dashboard so you can revisit them without searching again.",
  },
];

const OWNER_STEPS = [
  "Create an owner account and start a listing from the dashboard.",
  "Add the basics, choose categories, upload photos, and set weekly business hours.",
  "Publish when you're ready, then come back any time to update details as your listing evolves.",
];

function LocalSteps() {
  return (
    <ol className={styles.localSteps}>
      {LOCAL_STEPS.map((step, index) => (
        <li key={step.copy} className={styles.localStep}>
          <span className={styles.stepNumber} aria-hidden="true">
            {index + 1}
          </span>
          <span className={`material-icons ${styles.localIcon}`} aria-hidden="true">
            {step.icon}
          </span>
          <p>{step.copy}</p>
        </li>
      ))}
    </ol>
  );
}

function OwnerSteps() {
  return (
    <ol className={styles.ownerSteps}>
      {OWNER_STEPS.map((step, index) => (
        <li key={step} className={styles.ownerStep}>
          <span className={styles.ownerNumber} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}.
          </span>
          <p>{step}</p>
        </li>
      ))}
    </ol>
  );
}

export default function HowItWorksPage() {
  return (
    <>
      <Navbar activeHref="/how-it-works" />

      <main className={styles.page}>
        <div className={styles.pageInner}>
          <section className={styles.hero} aria-labelledby="how-it-works-title">
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>
                <span className={`material-icons ${styles.eyebrowStar}`} aria-hidden="true">
                  star
                </span>
                TX Localist // How It Works
                <span className={`material-icons ${styles.eyebrowStar}`} aria-hidden="true">
                  star
                </span>
              </p>

              <h1 id="how-it-works-title" className={styles.title}>
                <span>Search local.</span>
                <span>Save the good stuff.</span>
                <span>Show up when</span>
                <span>it matters.</span>
              </h1>

              <span className={styles.brushRule} aria-hidden="true" />

              <p className={styles.lede}>
                TX Localist is built for two groups at once: locals trying to find great Texas
                businesses, and owners who want a cleaner, more useful way to be discovered.
              </p>
            </div>

            <div className={styles.heroMedia}>
              <Image
                src={heroImage}
                alt="A vintage postcard collage of downtown Gruene, Texas"
                priority
                sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1100px) 52vw, 650px"
                className={styles.heroImage}
              />
            </div>
          </section>

          <section
            className={styles.localsSection}
            aria-labelledby="locals-title"
          >
            <div className={styles.localsHeading}>
              <span className={`material-icons ${styles.headingStar}`} aria-hidden="true">
                star
              </span>
              <h2 id="locals-title">For locals</h2>
              <span className={styles.smallBrushRule} aria-hidden="true" />
            </div>
            <LocalSteps />
          </section>

          <section className={styles.ownersSection} aria-labelledby="owners-title">
            <div className={styles.ownerTitlePanel}>
              <h2 id="owners-title">For business owners</h2>
              <Image
                src={longhornImage}
                alt=""
                aria-hidden="true"
                className={styles.ownerLonghorn}
              />
            </div>

            <div className={styles.ownerProcess}>
              <OwnerSteps />
            </div>

            <div className={styles.ownerMedia}>
              <Image
                src={gasStationImage}
                alt="A vintage Lone Star gas pump beside a Welcome to Texas mural"
                fill
                sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1100px) 46vw, 520px"
                className={styles.ownerImage}
              />
            </div>
          </section>

          <section className={styles.plansSection} aria-labelledby="plans-title">
            <div className={styles.plansMedia}>
              <Image
                src={bluebonnetImage}
                alt="Texas bluebonnets across rolling hills at sunset"
                fill
                sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1100px) 48vw, 560px"
                className={styles.plansImage}
              />
              <span className={styles.texasBadge} aria-hidden="true">
                <span>Built for</span>
                <strong>Texas</strong>
                <span className={`material-icons ${styles.badgeStar}`}>star</span>
              </span>
            </div>

            <div className={styles.plansCopy}>
              <span className={`material-icons ${styles.plansStar}`} aria-hidden="true">
                star
              </span>
              <h2 id="plans-title">Plans and visibility</h2>
              <p>
                Free listings help you get into the directory quickly. Paid plans unlock extra
                visibility, richer listing details, additional photos, and more owner-facing
                features over time.
              </p>
              <span className={styles.dividerRule} aria-hidden="true" />
              <p>
                You can compare plan levels on the{" "}
                <Link href="/pricing" className={styles.inlineLink}>
                  pricing page
                </Link>
                .
              </p>
            </div>
          </section>

          <section className={styles.ctaSection} aria-labelledby="cta-title">
            <div className={styles.ctaMark} aria-hidden="true">
              <p>Keep it local</p>
              <Image src={longhornImage} alt="" className={styles.ctaLonghorn} />
            </div>

            <div className={styles.ctaCopy}>
              <h2 id="cta-title">Start exploring Texas businesses</h2>
              <p>
                Browse the directory, filter by what you need, and save places you want to come
                back to later.
              </p>
            </div>

            <Link href="/results" className={styles.ctaButton}>
              <span>Explore Listings</span>
              <span className={`material-icons ${styles.buttonIcon}`} aria-hidden="true">
                arrow_forward
              </span>
            </Link>
          </section>
        </div>
      </main>

      <Footer compact />
    </>
  );
}
