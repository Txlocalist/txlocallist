"use client";
import { useActionState, useState } from "react";
import { updateProfileAction } from "@/app/actions/auth";
import styles from "../dashboard.module.css";

export function ProfileForm({ user }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateProfileAction, { error: "", success: "", fieldErrors: {} });
  if (!editing && !state.success) return <button type="button" className={styles.settingButton} onClick={() => setEditing(true)}>Edit Profile</button>;
  return <form action={action} className={styles.settingsForm} onSubmit={() => setEditing(true)}>
    {state.error ? <p className={styles.errorMessage} role="alert">{state.error}</p> : null}
    {state.success ? <p className={styles.successMessage} role="status">{state.success}</p> : null}
    <label className={styles.settingLabel} htmlFor="profile-name">Name</label>
    <input id="profile-name" name="name" defaultValue={user.name || ""} maxLength={80} autoComplete="name" className={styles.settingsInput} aria-invalid={Boolean(state.fieldErrors?.name)} />
    <div className={styles.pageActions}><button className={styles.settingButton} type="submit" disabled={pending}>{pending ? "Saving…" : "Save Profile"}</button><button className={styles.settingButton} type="button" onClick={() => setEditing(false)}>Cancel</button></div>
  </form>;
}
