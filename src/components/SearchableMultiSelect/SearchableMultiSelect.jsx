"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./SearchableMultiSelect.module.css";

/** A controlled, searchable disclosure with native multi-select checkboxes. */
export default function SearchableMultiSelect({
  label,
  options = [],
  selected = [],
  onChange,
  limit,
  hint,
  error,
  placeholder,
  onCreateOption,
  createOptionLabel = "Add",
  canCreateOption,
}) {
  const id = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const fieldName = label.toLowerCase();
  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLocaleLowerCase();
  const hasLimit = Number.isFinite(limit);
  const atLimit = hasLimit && selected.length >= limit;
  const selectedIds = new Set(selected);
  const optionsById = new Map(options.map((option) => [option.id, option]));
  const filteredOptions = options.filter((option) => option.name.toLocaleLowerCase().includes(normalizedQuery));
  const showCreateOption = Boolean(
    onCreateOption
    && trimmedQuery
    && !options.some((option) => option.name.toLocaleLowerCase() === normalizedQuery)
    && (!canCreateOption || canCreateOption(trimmedQuery)),
  );
  const descriptionIds = [
    `${id}-count`,
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ].filter(Boolean).join(" ");

  useEffect(() => {
    if (!isOpen) return;

    searchRef.current?.focus({ preventScroll: true });
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [isOpen]);

  function closeAndFocusTrigger() {
    setIsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function open() {
    setQuery("");
    setIsOpen(true);
  }

  function toggleOption(optionId) {
    if (selectedIds.has(optionId)) {
      onChange(selected.filter((selectedId) => selectedId !== optionId));
    } else if (!atLimit) {
      onChange([...selected, optionId]);
    }
  }

  function addOption() {
    if (!showCreateOption || atLimit) return;
    onCreateOption(trimmedQuery);
    setQuery("");
    searchRef.current?.focus({ preventScroll: true });
  }

  return (
    <fieldset
      className={styles.field}
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target.type === "checkbox") event.preventDefault();
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          closeAndFocusTrigger();
        }
      }}
    >
      <legend className={styles.label}>{label}</legend>
      <div className={styles.meta}>
        {hint && <p id={`${id}-hint`} className={styles.hint}>{hint}</p>}
        <span id={`${id}-count`} className={styles.count} aria-live="polite" aria-atomic="true">
          {hasLimit ? `${selected.length}/${limit} selected` : `${selected.length} selected`}
        </span>
      </div>

      <div className={styles.disclosure}>
        <button
          ref={triggerRef}
          type="button"
          className={`${styles.trigger} ${error ? styles.triggerError : ""}`}
          aria-label={`Choose ${fieldName}`}
          aria-expanded={isOpen}
          aria-controls={`${id}-panel`}
          aria-describedby={descriptionIds}
          onClick={() => isOpen ? setIsOpen(false) : open()}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (isOpen) searchRef.current?.focus();
              else open();
            }
          }}
        >
          <span className={styles.triggerText}>
            {selected.length ? `${selected.length} selected — edit ${fieldName}` : placeholder || `Choose ${fieldName}`}
          </span>
          <svg className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {isOpen && (
          <div id={`${id}-panel`} className={styles.panel}>
            <div className={styles.searchRow}>
              <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                className={styles.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${fieldName}…`}
                aria-label={`Search ${fieldName}`}
                autoComplete="off"
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    listRef.current?.querySelector('input:not(:disabled)')?.focus();
                  }
                }}
              />
            </div>

            <div className={styles.list} ref={listRef}>
              {filteredOptions.length ? filteredOptions.map((option) => (
                <label className={styles.option} key={option.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(option.id)}
                    disabled={atLimit && !selectedIds.has(option.id)}
                    onChange={() => toggleOption(option.id)}
                  />
                  <span>{option.name}</span>
                </label>
              )) : (
                <p className={styles.empty} role="status">
                  {trimmedQuery ? "No matches found. Try another search." : `No ${fieldName} available yet.`}
                </p>
              )}
            </div>

            {showCreateOption && (
              <button className={styles.createButton} type="button" disabled={atLimit} onClick={addOption}>
                {createOptionLabel} “{trimmedQuery}”
              </button>
            )}

            <div className={styles.footer}>
              <p className={styles.footerHint}>
                {atLimit ? "Limit reached. Remove a selection to choose another." : "Select from the list or type to filter."}
              </p>
              <button type="button" className={styles.doneButton} onClick={closeAndFocusTrigger}>Done</button>
            </div>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <ul className={styles.chips} aria-label={`Selected ${fieldName}`}>
          {selected.map((optionId) => {
            const name = optionsById.get(optionId)?.name || String(optionId);
            return (
              <li className={styles.chip} key={optionId}>
                <span>{name}</span>
                <button
                  type="button"
                  className={styles.removeButton}
                  aria-label={`Remove ${name}`}
                  onClick={(event) => {
                    if (event.currentTarget === document.activeElement) triggerRef.current?.focus({ preventScroll: true });
                    onChange(selected.filter((selectedId) => selectedId !== optionId));
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p id={`${id}-error`} className={styles.error} role="alert">{error}</p>}
    </fieldset>
  );
}
