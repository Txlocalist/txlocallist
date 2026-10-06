"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./post.module.css";

export default function CraftYourLookAdvice() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" className={styles.adviceLink} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Advice on Crafting Your Look
      </button>
      <dialog
        ref={dialogRef}
        className={styles.adviceDialog}
        aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); setOpen(false); }}
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      >
        <div className={styles.adviceContent}>
          <button ref={closeRef} type="button" className={styles.adviceClose} aria-label="Close profile advice" onClick={() => setOpen(false)}>
            <span className="material-icons" aria-hidden="true">close</span>
          </button>
          <h2 id={titleId}>Advice on Crafting Your Look</h2>
          <section aria-labelledby={`${titleId}-description`}>
            <h3 id={`${titleId}-description`}>Business Description</h3>
            <p>Tell customers what your business does, what you offer, and what makes you special. Use simple keywords people may search for online.</p>
            <p>List your main products or services. Put the most important ones first. Indicate if you are HIRING!</p>
          </section>
          <section aria-labelledby={`${titleId}-images`}>
            <h3 id={`${titleId}-images`}>Images</h3>
            <p>Add 3 clear images:</p>
            <ul><li>1 logo</li><li>2 photos of your products, services, or work</li></ul>
            <dl className={styles.imageSpecs}>
              <div><dt>Image size</dt><dd>Up to 8MB per image</dd></div>
              <div><dt>File type</dt><dd>JPG, PNG, WEBP, or GIF</dd></div>
            </dl>
          </section>
          <section aria-labelledby={`${titleId}-social`}>
            <h3 id={`${titleId}-social`}>Social Media</h3>
            <p>Add links to your business social media pages and website. Check that each link works.</p>
          </section>
          <section aria-labelledby={`${titleId}-details`}>
            <h3 id={`${titleId}-details`}>Business Details</h3>
            <p>Make sure your business name, phone number, address, hours, and service area are correct.</p>
          </section>
          <section aria-labelledby={`${titleId}-publish`}>
            <h3 id={`${titleId}-publish`}>Before You Publish</h3>
            <p>Check your spelling, links, phone number, hours, and photos.</p>
          </section>
        </div>
      </dialog>
    </>
  );
}
