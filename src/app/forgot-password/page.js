import Link from "next/link";
import { PasswordResetRequestForm } from "./PasswordResetRequestForm";
import styles from "../login/login.module.css";

export default function ForgotPasswordPage() {
  return <main className={styles.page}><div className={styles.shell}><section className={styles.authPanel}><div className={styles.authCard}>
    <h1>Reset your password</h1><p className={styles.helper}>Enter your account email and we’ll send a link that is valid for one hour.</p>
    <PasswordResetRequestForm /><Link href="/login">Back to sign in</Link>
  </div></section></div></main>;
}
