import LandingPageTemplate from "./LandingPageTemplate";
import styles from "./home.module.css";

export const metadata = {
  title: "Texas Localist | Find What's Nearby. Fast.",
  description:
    "The no-nonsense directory for the Lone Star State. No ads. No tracking. Just Texas.",
};

export default function Home() {
  return (
    <LandingPageTemplate
      heading={
        <>
          Find whats
          <br />
          <span className={styles.heroPrimary}>Local .</span>{" "}
          <span className={styles.heroUnderline}>Fast.</span>
        </>
      }
      tagline="The no-nonsense directory for the Lone Star State. No ads. No tracking. Just Texas."
    />
  );
}
