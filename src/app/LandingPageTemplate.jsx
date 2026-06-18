import { Footer, Navbar } from "@/components";
import EventLandingHeader from "@/components/EventLandingHeader/EventLandingHeader";
import HomeExperience from "./HomeExperience";

export default function LandingPageTemplate({
  initialType = "businesses",
  visibleTypes = ["businesses", "events"],
  businessEyebrow,
  businessHeadingIntro,
  businessAccent,
  businessUnderline,
  businessTagline,
}) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <Navbar />
      <EventLandingHeader />
      <HomeExperience
        initialType={initialType}
        visibleTypes={visibleTypes}
        businessEyebrow={businessEyebrow}
        businessHeadingIntro={businessHeadingIntro}
        businessAccent={businessAccent}
        businessUnderline={businessUnderline}
        businessTagline={businessTagline}
      />
      <Footer />
    </>
  );
}
