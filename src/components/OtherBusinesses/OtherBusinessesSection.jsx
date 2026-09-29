"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./OtherBusinessesSection.module.css";

const OWNER_SIGNUP = "/signup?intent=owner&next=%2Fdashboard%2Fbilling";

// A new search starts its own pagination and cannot show an older search's rows.
export default function OtherBusinessesSection({ q = "", loc = "", category = "", citySlug = "" }) {
  return <OtherBusinessesList key={JSON.stringify([q, loc, category, citySlug])} q={q} loc={loc} category={category} citySlug={citySlug} />;
}

function OtherBusinessesList({ q, loc, category, citySlug }) {
  const headingId = useId();
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState(null);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const revisionRef = useRef(undefined);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const triggerRef = useRef(null);
  const requestKey = `${page}:${retry}`;
  const isLoading = response?.key !== requestKey;
  const error = !isLoading && response?.error;
  const data = response?.data;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    if (loc) params.set("loc", loc);
    if (category) params.set("category", category);
    if (citySlug) params.set("citySlug", citySlug);

    async function load() {
      try {
        const result = await fetch(`/api/other-businesses?${params}`, { signal: controller.signal, cache: "no-store" });
        if (!result.ok) throw new Error("Other businesses request failed");
        const payload = await result.json();
        if (!payload.success || !Array.isArray(payload.data?.results)) throw new Error("Invalid other businesses response");
        if (controller.signal.aborted) return;

        const next = payload.data;
        const revisionChanged = revisionRef.current !== undefined && revisionRef.current !== next.revision;
        revisionRef.current = next.revision;
        if (page > 1 && (revisionChanged || next.results.length === 0)) {
          setNotice("This list has been updated. Showing the first page.");
          setResponse(null);
          setPage(1);
          return;
        }
        setResponse({ key: requestKey, data: next });
      } catch {
        if (!controller.signal.aborted) {
          setResponse({ key: requestKey, error: "Other businesses could not be loaded. Please try again." });
        }
      }
    }
    load();
    return () => controller.abort();
  }, [q, loc, category, citySlug, page, requestKey]);

  useEffect(() => {
    if (!selected) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [selected]);

  function closeDialog() {
    dialogRef.current?.close();
    setSelected(null);
    triggerRef.current?.focus();
  }

  function trapDialogFocus(event) {
    if (event.key !== "Tab") return;
    const controls = [...dialogRef.current.querySelectorAll("button:not(:disabled), a[href]")];
    const first = controls[0];
    const last = controls.at(-1);
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }

  if (!isLoading && !error && data?.total === 0) return null;

  return (
    <section className={styles.section} aria-labelledby={headingId} aria-busy={isLoading}>
      <div className={styles.header}>
        <h2 id={headingId}>Other businesses</h2>
        {!isLoading && !error && data ? <p>{data.total.toLocaleString("en-US")} {data.total === 1 ? "business" : "businesses"} <span aria-hidden="true">·</span> A–Z</p> : null}
      </div>

      {notice ? <p className={styles.status} role="status">{notice}</p> : null}
      {isLoading ? <p className={styles.status} role="status">Loading other businesses…</p> : error ? (
        <div className={styles.error}>
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
        </div>
      ) : (
        <ul className={styles.list}>
          {data.results.map((business) => (
            <li key={business.id}>
              <button
                type="button"
                className={styles.row}
                aria-haspopup="dialog"
                aria-label={`Learn about listing ${business.name}`}
                onClick={(event) => { triggerRef.current = event.currentTarget; setSelected(business); }}
              >
                <span className={styles.rowBody}>
                  <strong className={styles.name}>{business.name}</strong>
                  <span className={styles.meta}><span>{business.city.name}</span><span aria-hidden="true">·</span><span>{business.category.name}</span></span>
                </span>
                <span className={`material-icons ${styles.arrow}`} aria-hidden="true">arrow_forward</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && !error && (data.total > data.pageSize || page > 1) ? (
        <nav className={styles.pagination} aria-label="Other businesses pages">
          <button type="button" disabled={isLoading || page <= 1} aria-label="Previous other businesses" onClick={() => { setNotice(""); setPage((value) => value - 1); }}>Previous</button>
          <span aria-live="polite">Page {page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
          <button type="button" disabled={isLoading || !data.hasMore} aria-label="Next other businesses" onClick={() => { setNotice(""); setPage((value) => value + 1); }}>Next</button>
        </nav>
      ) : null}

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        onKeyDown={trapDialogFocus}
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClose={() => { setSelected(null); triggerRef.current?.focus(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
      >
        <div className={styles.dialogContent}>
          <button ref={closeRef} type="button" className={styles.close} aria-label="Close business invitation" onClick={closeDialog}><span className="material-icons" aria-hidden="true">close</span></button>
          <p className={styles.businessName}>{selected?.name}</p>
          <h2 id={dialogTitleId}>Is this your business?</h2>
          <p id={dialogDescriptionId} className={styles.invitation}>Join the Localist</p>
          <Link href={OWNER_SIGNUP} className={styles.signup}>Create an account<span className="material-icons" aria-hidden="true">arrow_forward</span></Link>
        </div>
      </dialog>
    </section>
  );
}
