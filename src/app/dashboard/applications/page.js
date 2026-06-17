import { redirect } from "next/navigation";
import Link from "next/link";

import { DashboardLayout } from "../DashboardShell";
import styles from "../dashboard.module.css";
import { getOwnerBillingState } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { isMissingPrismaTableError, phase3SchemaMessage } from "@/lib/prisma-errors";

export default async function ApplicationsPage() {
  const session = await getCurrentSession();

  if (!session || !session.user) {
    redirect("/login");
  }

  const user = session.user;
  const billingState = await getOwnerBillingState(user.id).catch(() => null);
  const canAccessCreatorTools = user.role === "ADMIN" || Boolean(billingState?.hasPaidAccess);

  if (!canAccessCreatorTools) {
    redirect("/dashboard");
  }

  let applications = [];
  let schemaNotice = null;

  try {
    applications = await prisma.businessApplication.findMany({
      where:
        user.role === "ADMIN"
          ? undefined
          : {
              business: {
                ownerId: user.id,
              },
            },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }
    schemaNotice = phase3SchemaMessage;
  }

  return (
    <DashboardLayout activeTab="applications">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Applications</h1>
          <p className={styles.pageSubtitle}>
            Review candidates who applied to your hiring listings.
          </p>
        </div>
      </div>

      {schemaNotice && (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Applications Unavailable</h2>
            <p className={styles.emptyStateDescription}>
              {schemaNotice} Apply the Prisma schema update and this page will populate normally.
            </p>
          </div>
        </div>
      )}

      {!schemaNotice &&
        (applications.length === 0 ? (
          <div className={styles.emptyState}>
            <h3 className={styles.emptyStateTitle}>No applications yet</h3>
            <p className={styles.emptyStateDescription}>
              When people apply through your listing pages, they will appear here.
            </p>
            <Link href="/dashboard/businesses" className={styles.emptyStateAction}>
              Manage Listings
            </Link>
          </div>
        ) : (
          <div className={styles.businessesTable}>
            <div className={styles.tableHeader}>
              <div className={styles.tableCol} style={{ flex: 2 }}>
                Applicant
              </div>
              <div className={styles.tableCol} style={{ flex: 1.2 }}>
                Role
              </div>
              <div className={styles.tableCol} style={{ flex: 1.6 }}>
                Listing
              </div>
              <div className={styles.tableCol} style={{ flex: 1 }}>
                Submitted
              </div>
              <div className={styles.tableCol} style={{ flex: 1.2 }}>
                Application
              </div>
            </div>

            <div className={styles.tableBody}>
              {applications.map((application) => (
                <div key={application.id} className={styles.tableRow}>
                  <div className={styles.tableCol} style={{ flex: 2 }}>
                    <div>
                      <p className={styles.businessName}>
                        {application.firstName} {application.lastName}
                      </p>
                      <p className={styles.businessMeta}>{application.email}</p>
                    </div>
                  </div>

                  <div className={styles.tableCol} style={{ flex: 1.2 }}>
                    <span className={styles.planBadge}>{application.role}</span>
                  </div>

                  <div className={styles.tableCol} style={{ flex: 1.6 }}>
                    <div>
                      <p className={styles.businessName}>{application.business.name}</p>
                      <p className={styles.businessMeta}>/{application.business.slug}</p>
                    </div>
                  </div>

                  <div className={styles.tableCol} style={{ flex: 1 }}>
                    <span className={styles.businessMeta}>
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(new Date(application.createdAt))}
                    </span>
                  </div>

                  <div className={styles.tableCol} style={{ flex: 1.2 }}>
                    <details className={styles.applicationDetails}>
                      <summary className={styles.applicationSummary}>
                        View Application
                      </summary>
                      <div className={styles.applicationPanel}>
                        <p className={styles.applicationPanelRow}>
                          <span className={styles.applicationPanelLabel}>First Name:</span>{" "}
                          {application.firstName}
                        </p>
                        <p className={styles.applicationPanelRow}>
                          <span className={styles.applicationPanelLabel}>Last Name:</span>{" "}
                          {application.lastName}
                        </p>
                        <p className={styles.applicationPanelRow}>
                          <span className={styles.applicationPanelLabel}>Email:</span>{" "}
                          {application.email}
                        </p>
                        <p className={styles.applicationPanelRow}>
                          <span className={styles.applicationPanelLabel}>Role:</span>{" "}
                          {application.role}
                        </p>
                        <p className={styles.applicationPanelRow}>
                          <span className={styles.applicationPanelLabel}>Listing:</span>{" "}
                          {application.business.name}
                        </p>
                        <p className={styles.applicationPanelRow}>
                          <span className={styles.applicationPanelLabel}>Submitted:</span>{" "}
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }).format(new Date(application.createdAt))}
                        </p>

                        <div className={styles.applicationPanelActions}>
                          <a
                            href={`/api/dashboard/applications/${application.id}/resume`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.actionButton}
                          >
                            View Resume
                          </a>
                          <Link
                            href={`/business/${application.business.slug}`}
                            target="_blank"
                            className={styles.actionButtonSecondary}
                          >
                            View Listing
                          </Link>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </DashboardLayout>
  );
}
