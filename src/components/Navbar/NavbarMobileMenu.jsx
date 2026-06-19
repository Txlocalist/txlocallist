"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import styles from "./Navbar.module.css";

export default function NavbarMobileMenu({ links, pillHref, pillLabel }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className={styles.mobileMenuWrap}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-controls={menuId}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-icons" aria-hidden="true">
          {open ? "close" : "menu"}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className={styles.mobileMenuOverlay}
            aria-label="Close navigation menu"
            onClick={closeMenu}
          />
          <div id={menuId} className={styles.mobileMenuPanel}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={styles.mobileMenuLink}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={pillHref}
              className={styles.mobileMenuCta}
              onClick={closeMenu}
            >
              {pillLabel}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
