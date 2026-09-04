import { ResetPasswordForm } from "./ResetPasswordForm";
import styles from "../login/login.module.css";

export default async function ResetPasswordPage({ searchParams }) {
  const { token = "" } = await searchParams;
  return <main className={styles.page}><div className={styles.shell}><section className={styles.authPanel}><div className={styles.authCard}>
    <h1>Choose a new password</h1><p className={styles.helper}>Use at least 12 characters.</p><ResetPasswordForm token={token} />
  </div></section></div></main>;
}
