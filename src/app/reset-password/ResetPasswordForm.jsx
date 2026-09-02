"use client";
import { useActionState } from "react";
import { resetPasswordAction } from "@/app/actions/auth";
import styles from "../login/login.module.css";

export function ResetPasswordForm({ token }) {
  const [state, action, pending] = useActionState(resetPasswordAction, { error: "", fieldErrors: {} });
  return <form action={action} className={styles.form} noValidate><input type="hidden" name="token" value={token} />
    {state.error ? <p className={styles.errorBanner} role="alert">{state.error}</p> : null}
    <div className={styles.field}><label className={styles.label} htmlFor="new-password">New password</label><input className={styles.input} id="new-password" name="password" type="password" autoComplete="new-password" required aria-invalid={Boolean(state.fieldErrors?.password)} />{state.fieldErrors?.password ? <p className={styles.fieldError}>{state.fieldErrors.password}</p> : null}</div>
    <div className={styles.field}><label className={styles.label} htmlFor="confirm-password">Confirm password</label><input className={styles.input} id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={Boolean(state.fieldErrors?.confirmPassword)} />{state.fieldErrors?.confirmPassword ? <p className={styles.fieldError}>{state.fieldErrors.confirmPassword}</p> : null}</div>
    <button className={styles.submitButton} type="submit" disabled={pending}>{pending ? "Updating…" : "Update password"}</button>
  </form>;
}
