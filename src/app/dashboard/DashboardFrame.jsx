"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import styles from "./DashboardShell.module.css";

export default function DashboardFrame({ children, title, navigation, account, menuLabel = "Dashboard navigation" }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 769px)");
    function handleResize() {
      if (desktop.matches) {
        dialogRef.current?.close();
        setOpen(false);
      }
    }
    desktop.addEventListener("change", handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", handleResize);
    };
  }, [open]);

  function closeMenu() {
    dialogRef.current?.close();
    setOpen(false);
  }

  function handleMenuKeys(event) {
    if (event.key !== "Tab") return;
    const controls = [...dialogRef.current.querySelectorAll(
      'a[href], button:not(:disabled), summary, input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
    )].filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className={styles.dashboardWrapper}>
      <div className={styles.dashboardContainer}>
        <div className={styles.desktopNavigation}>{navigation}</div>
        <section className={styles.mainPane}>
          <header className={styles.topbar}>
            <div className={styles.topbarLead}>
              <button
                type="button"
                className={`${styles.menuButton} ${styles.mobileMenuTrigger}`}
                aria-label="Open dashboard navigation"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={menuId}
                onClick={() => setOpen(true)}
              >
                <span className="material-icons" aria-hidden="true">menu</span>
              </button>
              <p className={styles.topbarTitle}>{title}</p>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.desktopAccount}>{account}</div>
              <Link href="/" className={styles.websiteButton}>
                <span className="material-icons" aria-hidden="true">arrow_back</span>
                <span>Back to Website</span>
              </Link>
            </div>
          </header>
          <main className={styles.mainContent}>{children}</main>
        </section>
      </div>

      <dialog
        ref={dialogRef}
        id={menuId}
        className={styles.navigationDialog}
        aria-label={menuLabel}
        onKeyDown={handleMenuKeys}
        onCancel={closeMenu}
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }}
      >
        <div className={styles.navigationPanel}>
          <div className={styles.navigationHeader}>
            <span className={styles.navigationTitle}>{menuLabel}</span>
            <button type="button" className={styles.menuButton} aria-label="Close dashboard navigation" onClick={closeMenu}>
              <span className="material-icons" aria-hidden="true">close</span>
            </button>
          </div>
          <div className={styles.navigationContent} onClick={(event) => {
            if (event.target.closest("a[href]")) closeMenu();
          }}>
            {navigation}
            <div className={styles.navigationAccount}>{account}</div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
