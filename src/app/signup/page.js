import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, getDashboardPath } from "@/lib/auth/session";

import styles from "../auth.module.css";
import { SignupForm } from "./SignupForm";

const ownerBullets = [
  "Your initial signup still creates a normal user account.",
  "Upgrade later in billing to unlock business listings and events.",
  "Month-to-month billing — cancel any time, no questions asked.",
];

const defaultBullets = [
  "User accounts are stored securely with hashed passwords.",
  "Successful signup starts a secure HTTP-only session immediately.",
  "Browse, save, and search local Texas businesses right away.",
];

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
        <div className={styles.card}>
          <p className={styles.eyebrow}>TX Local List // {isOwner ? "List Your Business" : "Sign Up"}</p>
          <h1 className={styles.title}>
            {isOwner ? "Create your account." : "Create your account."}
          </h1>
          <p className={styles.lede}>
            {isOwner
              ? "Sign up as a normal user first, then upgrade in billing when you're ready to post your business."
              : "Register an account and start discovering local Texas businesses."}
          </p>

          <SignupForm intent={intent} />

          <p className={styles.switchText}>
            Already have an account? <Link href="/login">Log in here.</Link>
          </p>
        </div>

        <aside className={styles.sidePanel}>
          <div>
            <p className={styles.eyebrow}>What happens next</p>
            <h2>
              {isOwner
                ? "You start as a normal user, then unlock creator access."
                : "The signup flow is tied directly into the access model."}
            </h2>
            <p className={styles.sideCopy}>
              {isOwner
                ? "After creating your account you'll land in billing. Once the $20 plan is active, business listings and dashboard event posting unlock."
                : "New users are created in the database and redirected to their dashboard after signup."}
            </p>
          </div>

          <ul className={styles.bulletList}>
            {(isOwner ? ownerBullets : defaultBullets).map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>

          {isOwner && (
            <p className={styles.sideCopy}>
              Want to see pricing first?{" "}
              <Link href="/pricing">View all plans →</Link>
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
