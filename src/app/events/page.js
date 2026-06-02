import LandingPageTemplate from "../LandingPageTemplate";
import styles from "../home.module.css";

export const metadata = {
  title: "Texas Localist | Local Events",
  description:
    "Find local Texas events without the noise. Search upcoming happenings across the state.",
};

export default function EventsPage() {
  return (
    <LandingPageTemplate
      heading={
        <>
          Find Texas
          <br />
          <span className={styles.heroPrimary}>Events .</span>{" "}
          <span className={styles.heroUnderline}>Fast.</span>
        </>
      }
      tagline="Search local events across Texas, from pop-ups to live music and community gatherings."
      initialType="events"
      visibleTypes={["events"]}
    />
  );
}
