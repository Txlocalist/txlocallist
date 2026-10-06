import Image from "next/image";
import Link from "next/link";
import { Navbar, Footer } from "@/components";
import CraftYourLookAdvice from "./CraftYourLookAdvice";
import styles from "./post.module.css";

export const metadata = {
  title: "Post Your Business | TX Localist",
  description: "Advertise your business on The Texas Localist for $10 a month. Build your local visibility with a full business profile. Cancel anytime.",
};

// Signup also sends existing account holders straight to billing.
const ACCOUNT_SETUP = "/signup?intent=owner&next=%2Fdashboard%2Fbilling";

const BENEFITS = [
  { title: "Increase Your Local Visibility", description: "Help people in your area discover your business when they are actively looking for the products and services you provide." },
  { title: "Build Trust", description: "Give prospective customers a professional place to learn more about your business, your services, and what makes you worth choosing." },
  { title: "Stay Competitive", description: "If customers are comparing local businesses, make sure yours is part of the conversation." },
  { title: "Make It Easy to Connect", description: "Give customers the information they need to call, visit, contact, or learn more about your business." },
  { title: "Strengthen Your Local Presence", description: "Your business is part of the community. Your online presence should reflect that." },
];

const STEPS = [
  { title: "Create Your Account", description: "Create a FREE user account." },
  { title: "Pay the Price", description: "Choose the $10 monthly business subscription. Cancel anytime." },
  { title: "Craft Your Look", description: "Add your business name, description, contact information, photos, and categories.", advice: true },
  { title: "Go Live", description: "Submit your profile for review. Once approved, customers can find you in local search. Approvals typically take 24 hours or less." },
];

const FEATURES = [
  { icon: "location_on", title: "Local Visibility", description: "Appear in city and keyword searches across Texas." },
  { icon: "call", title: "Direct Contact", description: "Let customers reach you directly with no middleman." },
  { icon: "photo_camera", title: "Photo Gallery", description: "Showcase your space, products, or team with photos." },
  { icon: "work", title: "Job Postings", description: "Post open positions and find local talent fast." },
  { icon: "link", title: "Website & Socials", description: "Link your website and social profiles to your listing." },
  { icon: "calendar_month", title: "Community Calendar", description: "Add your events to the community calendar so locals can discover your gatherings, promotions, and happenings.", calendar: true },
];

const TESTIMONIALS = [
  { quote: "The Texas Localist gave us another way to introduce our business to people right here in our community. The profile was easy to create and it gives potential customers a clear picture of what we offer.", role: "Local Business Owner", business: "Heaven's Best Carpet Cleaner", city: "Round Rock" },
  { quote: "We wanted to strengthen our local presence and make it easier for customers to find us.", role: "Texas Small Business Owner", business: "Cluck and Wag Farmstand", city: "Georgetown" },
  { quote: "Anything that helps connect local customers with local businesses is valuable. We’re happy to be part of it.", role: "Owner", business: "Round Table Pizza", city: "Round Rock" },
];

const FAQS = [
  { question: "What is The Texas Localist?", answer: "The Texas Localist is a platform designed to help people discover businesses, services, and local resources throughout Texas." },
  { question: "Why should I create a business profile?", answer: "A business profile gives customers another way to discover your business and learn what you offer. It also helps you present important business information in one convenient place." },
  { question: "Who can advertise?", answer: "Businesses that serve Texas communities can register for an account and create a business profile, subject to The Texas Localist’s listing guidelines and terms." },
  { question: "What information can I add to my profile?", answer: "Your available profile features may include your business description, contact information, website, hours, photos, services, categories, social links, and other relevant business details." },
  { question: "Can I update my profile later?", answer: "Yes. You can sign in to your account to manage and update your business information as needed." },
  { question: "How long does it take to create a profile?", answer: "You can begin by registering your account and adding your essential business information. Additional details can be added to make your profile more complete." },
  { question: "Where does the “Advertise My Business” button take me?", answer: "It takes you directly to Account Setup, where you can register and begin creating your business profile." },
];

function AdvertiseButton({ children = "Advertise My Business" }) {
  return <Link href={ACCOUNT_SETUP} className={styles.primaryButton}>{children}<span className={`material-icons ${styles.buttonIcon}`} aria-hidden="true">arrow_forward</span></Link>;
}

function SectionRule() {
  return <div className={styles.sectionRule} aria-hidden="true"><span>★</span></div>;
}

export default function PostYourBusinessPage() {
  return (
    <div className={styles.pageShell}>
      <Navbar activeHref="/post-your-business" />
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="advertise-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>TX Localist // Advertise</p>
            <h1 id="advertise-title">Be seen. Build trust.</h1>
            <p className={styles.heroSubtitle}>Earn more local customers in your community with a full business profile on The Texas Localist.</p>
            <div className={styles.actions}>
              <AdvertiseButton />
              <Link href="/pricing" className={styles.secondaryButton}>View Pricing</Link>
            </div>
          </div>
          <div className={styles.heroMedia} aria-hidden="true">
            <Image src="/addvertise-1.webp" alt="A Texas farmer holding the American flag above a sunlit field" fill priority sizes="(max-width: 1208px) calc(100vw - 48px), 1160px" className={styles.heroImage} />
          </div>
        </section>
        <SectionRule />
        <section className={styles.benefitsSection} aria-labelledby="benefits-title">
          <div className={styles.benefitsCopy}>
            <h2 id="benefits-title">Why Advertise on The Texas Localist?</h2>
            <ul className={styles.benefitList}>
              {BENEFITS.map((benefit) => <li key={benefit.title}><span className={`material-icons ${styles.benefitIcon}`} aria-hidden="true">check_circle</span><div><h3>{benefit.title}</h3><p>{benefit.description}</p></div></li>)}
            </ul>
          </div>
          <aside id="pricing" className={styles.priceCard} aria-labelledby="price-title">
            <p className={styles.eyebrow}>Simple, honest pricing</p>
            <h2 id="price-title">One Low Price for All Businesses</h2>
            <p className={styles.price}>$10 <span>/ month</span></p>
            <p className={styles.priceTerms}>No complicated contracts.<br />Cancel anytime.</p>
            <div className={styles.priceRule} aria-hidden="true">★</div>
            <p className={styles.priceDescription}>Register an account and create a full business profile to give local customers another reason to choose you.</p>
            <AdvertiseButton />
            <Link href="/pricing" className={styles.textLink}>View pricing details</Link>
          </aside>
        </section>
        <SectionRule />
        <section className={styles.featuresSection} aria-labelledby="features-title">
          <h2 id="features-title">Everything You Need to Get Found</h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((feature) => (
              <article key={feature.title} className={`${styles.featureCard} ${feature.calendar ? styles.calendarCard : ""}`}>
                <span className={`material-icons ${styles.featureIcon}`} aria-hidden="true">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                {feature.calendar ? <Link href="/events" className={styles.textLink}>View the community calendar<span className="material-icons" aria-hidden="true">arrow_forward</span></Link> : null}
              </article>
            ))}
          </div>
        </section>
        <SectionRule />
        <section className={styles.stepsSection} aria-labelledby="steps-title">
          <h2 id="steps-title">How It Works</h2>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                {step.advice ? <CraftYourLookAdvice /> : null}
              </li>
            ))}
          </ol>
        </section>
        <section className={styles.communitySection} aria-labelledby="community-title">
          <div className={styles.communityMedia}><Image src="/welcome.webp" alt="Welcome to Texas roadside sign and state flag" fill sizes="(max-width: 760px) calc(100vw - 40px), 480px" className={styles.communityImage} /></div>
          <div className={styles.communityCopy}>
            <h2 id="community-title">Buy Local and Support the Community</h2>
            <p>The Texas Localist is built around a simple idea: Make it easier for Texans to discover and support businesses in their own communities.</p>
            <p>When you advertise your business, you’re not just creating another online listing. You’re giving local customers another way to find, learn about, and connect with you.</p>
            <AdvertiseButton>Join The Texas Localist</AdvertiseButton>
          </div>
        </section>
        <section className={styles.testimonialsSection} aria-labelledby="testimonials-title">
          <h2 id="testimonials-title">What Local Businesses Are Saying</h2>
          <div className={styles.testimonials}>
            {TESTIMONIALS.map((testimonial) => <figure key={testimonial.business}><blockquote><p>“{testimonial.quote}”</p></blockquote><figcaption><strong>{testimonial.business}</strong><span>{testimonial.role} · {testimonial.city}</span></figcaption></figure>)}
          </div>
          <AdvertiseButton />
        </section>
        <SectionRule />
        <section className={styles.faqSection} aria-labelledby="faq-title">
          <h2 id="faq-title">Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            {FAQS.map((faq) => <details key={faq.question}><summary>{faq.question}<span className={`material-icons ${styles.faqIcon}`} aria-hidden="true">add</span></summary><p>{faq.answer}</p></details>)}
          </div>
        </section>
        <section className={styles.ctaSection} aria-labelledby="advertise-cta-title">
          <h2 id="advertise-cta-title">Advertise your business on The Texas Localist today.</h2>
          <div className={styles.actions}><AdvertiseButton /><Link href="/pricing" className={styles.secondaryButton}>View Pricing</Link></div>
        </section>
      </main>
      <Footer compact />
    </div>
  );
}
