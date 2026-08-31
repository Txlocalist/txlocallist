"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createStaffAction } from "@/app/actions/auth";

import styles from "../portal.module.css";

const INITIAL_STATE = {
  error: "",
  fieldErrors: {},
  success: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.submitButton} disabled={pending}>
      {pending ? "Creating staff account..." : "Create staff account"}
    </button>
  );
}

export function StaffCreateForm() {
  const [state, formAction] = useActionState(createStaffAction, INITIAL_STATE);

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.error ? (
        <p className={styles.errorBanner} role="alert">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className={styles.successBanner} aria-live="polite">
          {state.success}
        </p>
      ) : null}

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="staff-role" className={styles.label}>
            Staff role
          </label>
          <select
            id="staff-role"
            name="role"
            defaultValue="MANAGER"
            className={styles.input}
            aria-describedby="staff-role-help"
          >
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
          <p id="staff-role-help" className={styles.formHelper}>
            Managers moderate content but cannot change roles, create staff, or manage billing.
          </p>
          {state.fieldErrors?.role ? (
            <p className={styles.fieldError}>{state.fieldErrors.role}</p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="staff-email" className={styles.label}>
            Staff email
          </label>
          <input
            id="staff-email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="staff@yourcompany.com"
            className={styles.input}
            required
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
          {state.fieldErrors?.email ? (
            <p className={styles.fieldError}>{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="staff-password" className={styles.label}>
            Password
          </label>
          <input
            id="staff-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 12 characters"
            className={styles.input}
            minLength={12}
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
          {state.fieldErrors?.password ? (
            <p className={styles.fieldError}>{state.fieldErrors.password}</p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="staff-confirm-password" className={styles.label}>
            Confirm password
          </label>
          <input
            id="staff-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat the password"
            className={styles.input}
            minLength={12}
            required
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          />
          {state.fieldErrors?.confirmPassword ? (
            <p className={styles.fieldError}>{state.fieldErrors.confirmPassword}</p>
          ) : null}
        </div>
      </div>

      <p className={styles.formHelper}>
        Public signup always creates a standard User account. Only Admins can create staff.
      </p>

      <SubmitButton />
    </form>
  );
}
