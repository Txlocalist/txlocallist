import Image from "next/image";
import Link from "next/link";

import { Navbar, Footer, SearchBar, BusinessCard, Button, CategoryPills } from "@/components";
import heroBackgroundArt from "@/app/assets/Tx Localist-03.png";
import styles from "./home.module.css";

const FEATURED_BUSINESSES = [
  {
    slug: "starlight-cafe-austin",
    name: "Starlight Cafe",
    city: "AUSTIN",
    description: "The best sourdough in the hill country. Family owned since 1974.",
    price: "$$",
    category: "Bakery",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA8A2GdyTWdqLn6jx-_hSITUXdNr3wORseQXb01vX21diKx9xFiAGyi9t78SHN7LRGsejMKYzNg9k6utvRci63AmGAfZkbZq71UX0gJcpgbtIV7rVYv4B2GwS2PWhMCEFlmqv-T9CXDkidJJ9fRyckmDUBcb97vf6uDBAK7BFRiDF9PjGPgZDX2VUxJUD0hu5tx8HfWMN97D5710zHV4daKtfJGXLDcQebSDfPbK_o7jVUIZTFcilrWR43Et2YLnSkOtuBwZv9vkwI",
    imageAlt: "Starlight Cafe storefront at dusk",
    badgeTone: "yellow",
  },
  {
    slug: "neon-cowboy-marfa",
    name: "Neon Cowboy",
    city: "MARFA",
    description:
      "Curated vintage Western wear and desert oddities. Truly one of a kind.",
    price: "$$$",
    category: "Retail",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBbEIBI6L9dC0ie9eU66YFIzNdrZyg083eCuDV666N6H9tAr94iR5gwTUOWmYyifRCsSopwn6rub9ymjqcFTgZ6_tlmoUguiR7rxL831CVzjMBBk6ec8bSYW_G5a00AqWmHKZTJpX6IFAOwUugfmtG6SYCiEBUWxI8gNUajUDFwMdUnKBpmGcd6TkE48IQRPY9B-CF7QzubJlb5lQsBt8ygRIECGar-DfsoO7NTJa6igIxonbvFHt1zxQl4RKa_mkf_S3Ba-lxJZuY",
    imageAlt: "Neon Cowboy vintage boutique exterior",
    badgeTone: "red",
  },
  {
    slug: "old-oak-bbq-lockhart",
    name: "Old Oak BBQ",
    city: "LOCKHART",
    description: "Central Texas style brisket smoked for 16 hours. No sauce needed.",
    price: "$",
    category: "Food",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDhb_JF5jLsjsWFF3OgR0xWgx6NxlHjg5et6OuMW3DsbsHQzGfH-p8ZwKK4MUf3t9AphDfz-dKM4ZvwBjd6F63BHyX0dkjpibA2eZhIm019AY8SnrRW1xCDmCsRRyXm4I6dtsS6JbEmsYcIHaizCKBz0Rpw6GkFXz2Ud_rUltWn6V0vCfapnJ00RJnlj2yJfVNNmKjZGaUXhvBnnGdM1ITZPu7Ajo8dIODcLA8BGOsMgASgDn58-BlebRW-ftzXmDsrsRdZpCGZgfk",
    imageAlt: "Old Oak BBQ pitmaster tending brisket",
    badgeTone: "teal",
  },
];

const FEATURES = [
  { icon: "block", label: "NO ADS", bg: "orange" },
  { icon: "volume_off", label: "NO NOISE", bg: "teal" },
  { icon: "star", label: "JUST LOCAL", bg: "yellow" },
  { icon: "thumb_up", label: "VERIFIED", bg: "red" },
];

const STEPS = [
  {
    number: 1,
    label: "PICK A VIBE",
    description: "Choose what you're in the mood for from our curated categories.",
    borderTone: "yellow",
  },
  {
    number: 2,
    label: "FIND THE SPOT",
    description: "Browse verified local favorites without any pesky advertisements.",
    borderTone: "teal",
  },
  {
    number: 3,
    label: "SUPPORT LOCAL",
    description: "Head on over and keep the Texas spirit alive and well.",
    borderTone: "red",
  },
];

export default function LandingPageTemplate({
  heading,
  tagline,
  initialType = "businesses",
  visibleTypes = ["businesses", "events"],
}) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <Navbar />

      <main id="main">
        <section className={styles.hero}>
          <div className={styles.heroBg} aria-hidden="true">
            <Image
              src={heroBackgroundArt}
              alt=""
              fill
              priority
              sizes="100vw"
              className={styles.heroBgArt}
            />
            <div className={styles.heroBgGradient}></div>
          </div>

          <h1 className={styles.heroHeading}>{heading}</h1>

          <p className={styles.heroTagline}>{tagline}</p>

          <SearchBar
            action="/results"
            initialType={initialType}
            visibleTypes={visibleTypes}
          />

          <CategoryPills />
        </section>

        <section className={styles.featuresStrip} aria-label="Why Texas Localist">
          <div className={styles.featuresContainer}>
            {FEATURES.map((feature, idx) => (
              <div key={feature.label} className={styles.featureItem}>
                <div
                  className={`${styles.featureIconCircle} ${styles[`featureTone_${feature.bg}`]}`}
                  data-index={idx}
                >
                  <span className={`material-icons ${styles.featureIcon}`} aria-hidden="true">
                    {feature.icon}
                  </span>
                </div>
                <span className={styles.featureLabel}>{feature.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.gemsSection} aria-labelledby="featured-heading">
          <div className={styles.gemsSectionHeader}>
            <h2 id="featured-heading" className={styles.gemsTitle}>
              Featured <br />
              <span className={styles.gemsTitleAccent}>Gems</span>
            </h2>
            <Link href="/results" className={styles.gemsLink}>
              SEE ALL BUSINESSES
            </Link>
          </div>

          <div className={styles.gemsGrid}>
            {FEATURED_BUSINESSES.map((business) => (
              <BusinessCard
                key={business.slug}
                business={business}
                badgeTone={business.badgeTone}
              />
            ))}
          </div>
        </section>

        <section className={styles.howItWorksSection} aria-labelledby="how-heading">
          <div className={styles.howItWorksContainer}>
            <h2 id="how-heading" className={styles.howItWorksTitle}>
              How it <span className={styles.howItWorksAccent}>Works.</span>
            </h2>

            <div className={styles.howItWorksGrid}>
              {STEPS.map((step) => (
                <div key={step.number} className={styles.stepItem}>
                  <div
                    className={`${styles.stepNumber} ${styles[`stepBorder_${step.borderTone}`]}`}
                  >
                    {step.number}
                  </div>
                  <h3 className={styles.stepLabel}>{step.label}</h3>
                  <p className={styles.stepDescription}>{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.ctaSection} aria-labelledby="cta-heading">
          <div className={styles.ctaBg} aria-hidden="true">
            <Image
              alt=""
              fill
              className={styles.ctaBgImage}
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBRyvcjY9K8xM4cLlT8qibxFqStnZHkHvPZehIiK60agkd3qaqgqhzVsncUqeV7XCZhseo8qtgJczyAv3PZUJ4ostdVn9_1II07tsiGIExEzrwnS4M52YpDQIdAPQJRE-SmctrFIeUHtEjq5A_7CKGBYtSKgk9NtI9doaiNeJSksFXZk0G9fpxAD00yCbhaHFKTo8e-2FaTQQU1SzhUaSGFUKNy-Scuy-vA49OSHWwI3uOk7wbJhs8xyt94Y31ZY7mnPOy8COiHodU"
              sizes="100vw"
            />
          </div>
          <div className={styles.ctaContainer}>
            <h2 id="cta-heading" className={styles.ctaTitle}>
              Skip the <span className={styles.ctaAccent}>Noise.</span>
            </h2>
            <p className={styles.ctaTagline}>No ads. No nonsense. Just local.</p>
            <Button as="link" href="/results" variant="cream" size="lg">
              START EXPLORING
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
