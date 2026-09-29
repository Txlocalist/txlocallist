"use client";

import { useActionState, useState } from "react";
import { createCategoryAction, renameCategoryAction } from "@/app/actions/categories";
import formStyles from "../../portal.module.css";
import styles from "./categories.module.css";

const INITIAL_STATE = { error: "", fieldErrors: {}, success: "" };

function CategoryForm({ type, category = null, onSuccess, onCancel }) {
  const [name, setName] = useState(category?.name ?? "");
  const [state, action, pending] = useActionState(async (previous, data) => {
    const result = await (category ? renameCategoryAction : createCategoryAction)(previous, data);
    if (result.success) {
      if (!category) setName("");
      onSuccess(result.success);
    }
    return result;
  }, INITIAL_STATE);
  const fieldId = `category-name-${type}-${category?.id ?? "new"}`;
  return <form action={action} className={styles.form} aria-label={category ? `Rename ${category.name}` : `Add ${type} category`}>
    <input type="hidden" name="type" value={type} />
    {category ? <>
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="expectedName" value={category.name} />
    </> : null}
    <label htmlFor={fieldId} className={formStyles.label}>Category name</label>
    <input id={fieldId} name="name" className={formStyles.input} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required disabled={pending} aria-invalid={Boolean(state.error)} aria-describedby={state.error ? `${fieldId}-error` : undefined} />
    {state.error ? <p id={`${fieldId}-error`} role="alert" className={styles.error}>{state.error}</p> : null}
    <div className={styles.actions}>
      <button type="submit" className={styles.button} disabled={pending}>{pending ? "Saving…" : category ? "Save name" : "Add category"}</button>
      {category ? <button type="button" className={styles.button} disabled={pending} onClick={onCancel}>Cancel</button> : null}
    </div>
  </form>;
}

export default function CategoryManager({ type, categories }) {
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  function onSuccess(success) {
    setMessage(success);
    setEditingId(null);
  }
  return <div className={styles.manager}>
    <section className={styles.create} aria-label={`New ${type} category`}>
      <h2>Add {type === "event" ? "an event" : "a business"} category</h2>
      <p>New categories are available in {type} creation and editing forms, even before they have listings.</p>
      <CategoryForm type={type} onSuccess={onSuccess} />
    </section>
    {message ? <p role="status" className={styles.success}>{message}</p> : null}
    <p>Renaming a category updates existing {type === "business" ? "business listings" : "events"} automatically. Existing links keep working.</p>
    {categories.length ? <ul className={styles.list} aria-label={`${type === "business" ? "Business" : "Event"} categories`}>
      {categories.map((category) => <li key={category.id}>
        <div className={styles.row}>
          <strong>{category.name}</strong>
          <span>{category.count} {type === "business" ? "business listings" : "events"}</span>
          <button type="button" className={styles.button} aria-label={`Edit ${category.name}`} onClick={() => setEditingId(category.id)} disabled={editingId !== null}>Edit name</button>
        </div>
        {editingId === category.id ? <div className={styles.edit}><CategoryForm type={type} category={category} onSuccess={onSuccess} onCancel={() => setEditingId(null)} /></div> : null}
      </li>)}
    </ul> : <p>No {type} categories yet. Add the first category above.</p>}
  </div>;
}
