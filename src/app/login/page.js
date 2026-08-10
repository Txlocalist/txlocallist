import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, getDashboardPath } from "@/lib/auth/session";
import { getSafeNextPath } from "@/lib/auth/redirect";
import landscapeImage from "@/app/assets/vintage Texas landscape.png";

import styles from "./login.module.css";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params?.next) ?? "";
  const user = await getCurrentUser();

  if (user) {
    redirect(nextPath || getDashboardPath(user.role));
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.brandPanel}>
          <div className={styles.brandInner}>
            <p className={styles.brandBadge}>TX Localist</p>
            <h1 className={styles.heroTitle}>Login</h1>
            <h2 className={styles.heroSubtitle}>Skip the noise. Get back to local.</h2>
            <p className={styles.heroCopy}>
              The definitive directory for the modern outlaw. Curated spaces,
              artisan crafts, and the heartbeat of Texas.
            </p>
            <div className={styles.landscapeFrame}>
              <Image
                src={landscapeImage}
                alt="Vintage Texas landscape"
                className={styles.landscapeImage}
                priority
              />
            </div>
          </div>
        </div>

        <aside className={styles.authPanel}>
          <div className={styles.authCard}>
            <LoginForm nextPath={nextPath} />

            <div className={styles.authDivider} />

            <p className={styles.authFooter}>Want to create a business listing later?</p>
            <Link
              href={nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup?intent=owner"}
              className={styles.authFooterLink}
            >
              Create a user account
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
