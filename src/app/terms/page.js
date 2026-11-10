import { StaticPageLayout } from "@/components/StaticPageLayout/StaticPageLayout";
import styles from "@/components/StaticPageLayout/StaticPageLayout.module.css";
import sections from "./terms-content.json";

export const metadata = {
  title: "Terms of Service | TX Localist",
  description: "Read the terms that govern use of TX Localist.",
};

export default function TermsPage() {
  return (
    <StaticPageLayout
      eyebrow="TX Localist // Terms"
      title="Terms of Service"
      lede="These terms govern access to and use of TX Localist."
      ctaTitle="Questions about these terms?"
      ctaCopy="If something here is unclear, reach out and we can point you in the right direction."
      ctaHref="/contact"
      ctaLabel="Contact Us"
    >
      <div className={styles.sectionCard}>
        <div className={styles.sectionBody}>
          <p>Effective date: November 10, 2026<br />Last updated: November 10, 2026</p>
        </div>
      </div>

      {sections.map((section) => (
        <section className={styles.sectionCard} key={section.title}>
          <h2 className={styles.sectionTitle}>{section.title}</h2>
          <div className={styles.sectionBody}>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} style={{ whiteSpace: "pre-line" }}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
    </StaticPageLayout>
  );
}
