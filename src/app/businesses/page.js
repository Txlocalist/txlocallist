import LandingPageTemplate from "../LandingPageTemplate";
import styles from "../home.module.css";

export const metadata = {
  title: "Texas Localist | Local Businesses",
  description:
    "Find local Texas businesses without the noise. Search verified spots across the state.",
};

export default function BusinessesPage() {
  return (
    <LandingPageTemplate
      heading={
        <>
          Find Texas
          <br />
          <span className={styles.heroPrimary}>Businesses .</span>{" "}
          <span className={styles.heroUnderline}>Fast.</span>
        </>
      }
      tagline="Search verified local businesses across Texas. No ads. No clutter. Just the spots worth finding."
      initialType="businesses"
      visibleTypes={["businesses"]}
    />
  );
}
