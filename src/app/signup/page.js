import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, getDashboardPath } from "@/lib/auth/session";
import landscapeImage from "@/app/assets/vintage Texas landscape.png";

import styles from "../login/login.module.css";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({ searchParams }) {
  const user = await getCurrentUser();

  if (user) {
    redirect(getDashboardPath(user.role));
  }

  const params = await searchParams;
  const intent = params?.intent ?? "";
  const isOwner = intent === "owner";

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.brandPanel}>
          <div className={styles.brandInner}>
            <p className={styles.brandBadge}>
              TX Localist {isOwner ? "// List Your Business" : "// Sign Up"}
            </p>
            <h1 className={styles.heroTitle}>Sign Up</h1>
            <h2 className={styles.heroSubtitle}>
              {isOwner ? "Claim your local presence." : "Start finding local favorites."}
            </h2>
            <p className={styles.heroCopy}>
              {isOwner
                ? "Create your account first, then unlock billing when you're ready to post listings and events."
                : "Create an account to browse, save, and keep up with local Texas businesses."}
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
            <SignupForm intent={intent} />

            <div className={styles.authDivider} />

            <p className={styles.authFooter}>Already have an account?</p>
            <Link href="/login" className={styles.authFooterLink}>
              Log in here
            </Link>

            {isOwner ? (
              <p className={styles.authFootnote}>
                You can review plans from billing after signup, or visit{" "}
                <Link href="/pricing">pricing</Link> first.
              </p>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
