import Image from "next/image";
import Link from "next/link";

import aboutBadgeImage from "@/app/assets/about-badge.webp";
import danceHallImage from "@/app/assets/texas-dance-hall.webp";
import landscapeImage from "@/app/assets/vintage Texas landscape.png";
import { Footer, Navbar } from "@/components";

import styles from "./about.module.css";

export const metadata = {
  title: "About | TX Localist",
  description: "Learn what TX Localist is building for Texas businesses and locals.",
};

const BELIEFS = [
  {
    icon: "storefront",
    copy: "Local businesses deserve visibility without having to outspend giant chains.",
  },
  {
    icon: "favorite",
    copy: "Users should be able to browse, save, and return to places without feeling tracked.",
  },
  {
    icon: "travel_explore",
    copy: "Directory pages should be useful the first time you land on them, not cluttered with junk.",
  },
  {
    icon: "location_city",
    copy: "Texas has distinct cities, neighborhoods, and scenes, and discovery should reflect that.",
  },
];

export default function AboutPage() {
  return (
    <div className={styles.pageShell}>
      <Navbar activeHref="/about" />

      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="about-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>TX Localist // About</p>
              <h1 id="about-title" className={styles.title}>
                Built for people who still care about place.
              </h1>
              <span className={styles.heroFlourish} aria-hidden="true">
                <span>★</span>
              </span>
              <p className={styles.lede}>
                TX Localist is a Texas-first directory designed to help people discover real local
                businesses without the clutter, ad noise, and algorithm games that bury good spots.
              </p>
            </div>

            <div className={styles.heroMedia} aria-hidden="true">
              <Image
                src={landscapeImage}
                alt=""
                fill
                priority
                sizes="(max-width: 760px) calc(100vw - 40px), 520px"
                className={styles.heroImage}
              />
              <Image
                src={aboutBadgeImage}
                alt=""
                width={168}
                height={168}
                className={styles.heroSeal}
              />
            </div>
          </div>
        </section>

        <div className={styles.sectionRule} aria-hidden="true">
          <span>★</span>
        </div>

        <section className={styles.originSection} aria-labelledby="why-title">
          <div className={styles.originInner}>
            <div className={styles.originLabel}>
              <span className={`material-icons ${styles.originIcon}`} aria-hidden="true">
                star
              </span>
              <span>Why we made it</span>
            </div>

            <div className={styles.originCopy}>
              <h2 id="why-title">Why we made it</h2>
              <p>
                Too many directories feel packed with spam, stale information, and paid placements
                that drown out the places people actually want to support. We wanted something
                simpler: fast search, local context, and listings that feel human.
              </p>
              <p>
                TX Localist focuses on discovery for Texans first. That means easier browsing by
                city, cleaner business pages, and tools that help owners show what makes their space
                worth visiting.
              </p>
            </div>
          </div>
        </section>

        <div className={styles.sectionRule} aria-hidden="true">
          <span>★</span>
        </div>

        <section className={styles.beliefsSection} aria-labelledby="beliefs-title">
          <div className={styles.beliefsInner}>
            <div className={styles.beliefsHeader}>
              <h2 id="beliefs-title">What we believe</h2>
            </div>

            <ul className={styles.beliefList}>
              {BELIEFS.map((belief) => (
                <li key={belief.copy} className={styles.beliefItem}>
                  <span
                    className={`material-icons ${styles.beliefIcon}`}
                    aria-hidden="true"
                  >
                    {belief.icon}
                  </span>
                  <span>{belief.copy}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.nextSection} aria-labelledby="next-title">
          <div className={styles.nextInner}>
            <div className={styles.nextMedia}>
              <Image
                src={danceHallImage}
                alt="A glowing Texas dance hall sign beside the state flag at dusk"
                fill
                sizes="(max-width: 760px) calc(100vw - 40px), 480px"
                className={styles.nextImage}
              />
            </div>

            <div className={styles.nextCopy}>
              <h2 id="next-title">What&apos;s next</h2>
              <p>
                We&apos;re continuing to expand local search, events, saved places, business profile
                depth, and owner tools so people can find what&apos;s nearby faster and businesses can
                keep their information current.
              </p>
              <p>
                Want to follow along or reach out directly? Visit the{" "}
                <Link href="/contact" className={styles.inlineLink}>
                  contact page
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <section className={styles.ctaSection} aria-labelledby="about-cta-title">
          <div className={styles.ctaCard}>
            <div className={styles.ctaCopy}>
              <p className={styles.ctaEyebrow}>Keep it local</p>
              <h2 id="about-cta-title">Ready to list your business?</h2>
              <p>
                Create your listing, add your photos and hours, and start showing up for nearby
                locals searching for something real.
              </p>
            </div>

            <Link href="/post-your-business" className={styles.ctaButton}>
              <span>Add Your Listing</span>
              <span className={`material-icons ${styles.buttonIcon}`} aria-hidden="true">
                arrow_forward
              </span>
            </Link>
          </div>
        </section>
      </main>

      <Footer compact />
    </div>
  );
}
