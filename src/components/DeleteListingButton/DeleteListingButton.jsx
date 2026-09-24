"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOwnedBusinessAction, deleteOwnedEventAction } from "@/app/actions/listing-deletion";
import styles from "./DeleteListingButton.module.css";

export default function DeleteListingButton({ id, name, kind, className, returnTo }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState(false);
  const successRef = useRef(null);
  const errorRef = useRef(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { if (removed) successRef.current?.focus(); }, [removed]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  function close() {
    if (pending) return;
    dialog.current?.close();
    trigger.current?.focus();
  }
  function remove() {
    setError("");
    startTransition(async () => {
      try {
        const result = await (kind === "business" ? deleteOwnedBusinessAction : deleteOwnedEventAction)({ id, confirmed: true });
        if (!result.success) { setError(result.error); return; }
        dialog.current?.close();
        setRemoved(true);
        if (returnTo) router.push(returnTo);
        router.refresh();
      } catch {
        setError("Deletion could not finish. Please try again.");
      }
    });
  }
  function trapFocus(event) {
    if (event.key !== "Tab") return;
    const buttons = [...dialog.current.querySelectorAll("button:not(:disabled)")];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (!first || !buttons.includes(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }
  if (removed) return <span ref={successRef} role="status" tabIndex={-1}>{name} deleted.</span>;
  return <>
    <button ref={trigger} type="button" className={className || styles.trigger} onClick={() => { setError(""); dialog.current?.showModal(); }}>Delete</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`delete-${kind}-${id}`} aria-describedby={`delete-description-${id}`} aria-busy={pending} onKeyDown={trapFocus} onCancel={(event) => { event.preventDefault(); close(); }}>
      <h2 id={`delete-${kind}-${id}`}>Delete {name}?</h2>
      <p id={`delete-description-${id}`}>This removes the {kind} from public listings and your results. You cannot restore it from your account.</p>
      {kind === "business" && <p>Membership happenings linked to this business will also go offline. You can manage or delete them in My Happenings.</p>}
      <p>Deleting a listing does not cancel your membership or issue a refund.</p>
      {error && <p ref={errorRef} role="alert" tabIndex={-1} className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" onClick={close} disabled={pending} autoFocus>Keep {kind}</button>
        <button type="button" onClick={remove} disabled={pending} className={styles.danger}>{pending ? "Deleting…" : `Delete ${kind}`}</button>
      </div>
    </dialog>
  </>;
}
