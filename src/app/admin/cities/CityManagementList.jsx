"use client";

import { useActionState, useState } from "react";
import { deleteCityAction, renameCityAction } from "@/app/actions/cities";
import { isUncategorizedCity } from "@/lib/cities";
import formStyles from "../../portal.module.css";
import styles from "./cities.module.css";

const INITIAL_STATE = { error: "", fieldErrors: {}, success: "" };

function CityActionForm({ city, mode, onClose, onSuccess }) {
  const deleting = mode === "delete";
  const [state, action, pending] = useActionState(async (previous, data) => {
    const result = await (deleting ? deleteCityAction : renameCityAction)(previous, data);
    if (result.success) onSuccess(result.success);
    return result;
  }, INITIAL_STATE);
  const [name, setName] = useState(city.name);
  if (state.success) return <div className={styles.panel}>
    <button type="button" className={styles.button} onClick={onClose}>Done</button>
  </div>;

  return <form action={action} className={styles.panel} aria-label={`${deleting ? "Delete" : "Rename"} ${city.name}`}>
    <input type="hidden" name="cityId" value={city.id} />
    <input type="hidden" name="expectedName" value={city.name} />
    {deleting ? <>
      <h3>Delete {city.name}?</h3>
      <p>All {city._count.businesses} full listings, {city._count.importedBusinesses ?? 0} other businesses, and any events in this Texas city will move to <strong>Uncategorized</strong>. Listings, subscriptions, and event payments will be preserved. Edit full listings individually or re-upload the master spreadsheet to assign other businesses a new city.</p>
      <input type="hidden" name="confirmed" value="yes" />
    </> : <>
      <label className={formStyles.label} htmlFor={`city-name-${city.id}`}>City name</label>
      <input id={`city-name-${city.id}`} name="name" className={formStyles.input} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={100} disabled={pending} aria-invalid={Boolean(state.error)} aria-describedby={`city-help-${city.id}`} />
      <p id={`city-help-${city.id}`}>The new name will appear on businesses and matching Texas events. Existing city links will keep working.</p>
    </>}
    {state.error ? <p role="alert" className={formStyles.errorBanner}>{state.error}</p> : null}
    <div className={styles.actions}>
      <button type="submit" className={`${styles.button} ${deleting ? styles.danger : ""}`} disabled={pending}>{pending ? "Saving…" : deleting ? "Delete city and reassign listings" : "Save name"}</button>
      <button type="button" className={styles.button} onClick={onClose} disabled={pending}>Cancel</button>
    </div>
  </form>;
}

function CityRow({ city, onSuccess }) {
  const [mode, setMode] = useState(null);
  const protectedCity = isUncategorizedCity(city);
  return <li className={styles.item}>
    <div className={styles.row}>
      <div><strong>{city.name}</strong><span className={styles.slug}>/{city.slug}</span></div>
      <span>{city._count.businesses} businesses · {city._count.importedBusinesses ?? 0} other businesses</span>
      {protectedCity ? <span className={styles.protected}>Protected fallback</span> : <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={() => setMode("rename")} disabled={mode !== null} aria-label={`Edit ${city.name}`}>Edit name</button>
        <button type="button" className={`${styles.button} ${styles.danger}`} onClick={() => setMode("delete")} disabled={mode !== null} aria-label={`Delete ${city.name}`}>Delete</button>
      </div>}
    </div>
    {mode ? <CityActionForm key={mode} city={city} mode={mode} onClose={() => setMode(null)} onSuccess={onSuccess} /> : null}
  </li>;
}

export default function CityManagementList({ cities }) {
  const [message, setMessage] = useState("");
  if (!cities.length) return <p>No cities yet. Add a Texas city above to get started.</p>;
  return <>
    {message ? <p role="status">{message}</p> : null}
    <ul className={styles.list} aria-label="Managed cities">{cities.map((city) => <CityRow key={city.id} city={city} onSuccess={setMessage} />)}</ul>
  </>;
}
