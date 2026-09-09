import { getPublicBusinessWhere } from "@/lib/listing-visibility";
import { notFound } from "next/navigation";
import Link from "next/link";

import { StaticPageLayout } from "@/components/StaticPageLayout/StaticPageLayout";
import layoutStyles from "@/components/StaticPageLayout/StaticPageLayout.module.css";
import { prisma } from "@/lib/prisma";

import { ApplyForm } from "./ApplyForm";

function parseHiringRoles(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((role) => role?.toString().trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug, ...getPublicBusinessWhere() },
    select: { name: true, status: true, isHiring: true },
  });

  if (!business || business.status !== "ACTIVE" || !business.isHiring) {
    return { title: "Application Not Available | TX Localist" };
  }

  return {
    title: `Apply to ${business.name} | TX Localist`,
    description: `Submit your application to ${business.name} on TX Localist.`,
  };
}

export default async function BusinessApplyPage({ params }) {
  const { slug } = await params;

  const business = await prisma.business.findUnique({
    where: { slug, ...getPublicBusinessWhere() },
    select: {
      slug: true,
      name: true,
      status: true,
      isHiring: true,
      hiringRoles: true,
    },
  });

  if (!business || business.status !== "ACTIVE" || !business.isHiring) {
    notFound();
  }

  const hiringRoles = parseHiringRoles(business.hiringRoles);
  if (hiringRoles.length === 0) {
    notFound();
  }

  return (
    <StaticPageLayout
      eyebrow="TX Localist // Hiring Application"
      title={`Apply to ${business.name}`}
      lede="Fill out the quick form below and upload your resume. The business owner will receive your application details directly."
      ctaTitle="Want to learn more first?"
      ctaCopy="Go back to the listing details and review hours, location, and current roles before submitting."
      ctaHref={`/business/${business.slug}`}
      ctaLabel="Back to Listing"
    >
      <div className={layoutStyles.sectionCard}>
        <h2 className={layoutStyles.sectionTitle}>Application Form</h2>
        <div className={layoutStyles.sectionBody}>
          <p>
            Applying for one of these roles: <strong>{hiringRoles.join(", ")}</strong>
          </p>
          <ApplyForm
            slug={business.slug}
            businessName={business.name}
            hiringRoles={hiringRoles}
          />
          <p>
            Need to verify listing details first? <Link href={`/business/${business.slug}`}>View business page</Link>.
          </p>
        </div>
      </div>
    </StaticPageLayout>
  );
}
