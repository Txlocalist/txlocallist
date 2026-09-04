"use client";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/app/actions/auth";
import styles from "../login/login.module.css";

export function PasswordResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, { error: "", success: "" });
  return <form action={action} className={styles.form} noValidate>
    {state.error ? <p className={styles.errorBanner} role="alert">{state.error}</p> : null}
    {state.success ? <p role="status">{state.success}</p> : null}
    <div className={styles.field}><label className={styles.label} htmlFor="reset-email">Email address</label><input className={styles.input} id="reset-email" name="email" type="email" autoComplete="email" required /></div>
    <button className={styles.submitButton} type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
  </form>;
}
