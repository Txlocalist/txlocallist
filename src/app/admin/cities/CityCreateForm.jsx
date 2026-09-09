"use client";

import { useActionState } from "react";
import { createCityAction } from "@/app/actions/cities";
import styles from "../../portal.module.css";

export default function CityCreateForm() {
  const [state, action, pending] = useActionState(createCityAction, { error: "", fieldErrors: {}, success: "" });
  return <form action={action} className={styles.form}>
    <div className={styles.field}>
      <label htmlFor="city-name" className={styles.label}>City name</label>
      <input id="city-name" name="name" className={styles.input} placeholder="San Marcos" required minLength={2} maxLength={100} disabled={pending} aria-invalid={Boolean(state.fieldErrors.name)} aria-describedby="city-message" />
      <p className={styles.formHelper}>Texas cities become available immediately, including cities with no listings yet.</p>
    </div>
    <p id="city-message" role={state.error ? "alert" : "status"} className={state.error ? styles.errorBanner : styles.successBanner}>{state.error || state.success}</p>
    <button className={styles.submitButton} disabled={pending}>{pending ? "Adding city…" : "Add city"}</button>
  </form>;
}
