"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { loginAction } from "@/app/actions/auth";

import styles from "./login.module.css";

const INITIAL_STATE = {
  error: "",
  fieldErrors: {},
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.submitButton} disabled={pending}>
      {pending ? "Signing in..." : "Sign In"}
      <span className="material-icons" aria-hidden="true">
        arrow_forward
      </span>
    </button>
  );
}

export function LoginForm({ nextPath = "" }) {
  const [state, formAction] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form action={formAction} className={styles.form} noValidate>
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      {state.error ? (
        <p className={styles.errorBanner} aria-live="polite">
          {state.error}
        </p>
      ) : null}

      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="sam@texaslocal.com"
          className={styles.input}
          required
        />
        {state.fieldErrors?.email ? (
          <p className={styles.fieldError}>{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <Link className={styles.assistText} href="/forgot-password">Forgot password?</Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="........"
          className={styles.input}
          required
        />
        {state.fieldErrors?.password ? (
          <p className={styles.fieldError}>{state.fieldErrors.password}</p>
        ) : null}
      </div>

      <label className={styles.checkboxRow}>
        <input type="checkbox" name="remember" className={styles.checkboxInput} />
        <span className={styles.checkboxVisual} aria-hidden="true"></span>
        <span className={styles.checkboxLabel}>Keep me signed in</span>
      </label>

      <SubmitButton />
    </form>
  );
}
