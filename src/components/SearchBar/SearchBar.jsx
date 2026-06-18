"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./SearchBar.module.css";

export default function SearchBar({
  action = "/results",
  initialQuery = "",
  initialLocation = "",
  defaultLocation = "Austin, TX",
  initialType = "businesses",
  visibleTypes = ["businesses", "events"],
  variant = "hero",
  autoSubmitOnTypeChange = false,
  typeChangeHrefMap,
  onSubmit,
  onTypeChange,
}) {
  const router = useRouter();
  const filteredTypes = useMemo(
    () =>
      Array.isArray(visibleTypes) && visibleTypes.length > 0
        ? visibleTypes.filter((value) => value === "businesses" || value === "events")
        : [],
    [visibleTypes]
  );
  const availableTypes = useMemo(
    () => (filteredTypes.length > 0 ? filteredTypes : ["businesses", "events"]),
    [filteredTypes]
  );
  const resolvedInitialType = availableTypes.includes(initialType)
    ? initialType
    : availableTypes[0];
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation || defaultLocation);
  const [type, setType] = useState(resolvedInitialType);
  const justChangedType = useRef(false);
  const typeOptions = useMemo(
    () =>
      [
        {
          value: "businesses",
          icon: "storefront",
          label: "Local Businesses",
          activeClass: styles.bizActive,
        },
        {
          value: "events",
          icon: "event",
          label: "Local Events",
          activeClass: styles.evtActive,
        },
      ].filter((option) => availableTypes.includes(option.value)),
    [availableTypes]
  );

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setLocation(initialLocation || defaultLocation);
  }, [defaultLocation, initialLocation]);

  useEffect(() => {
    setType(resolvedInitialType);
  }, [resolvedInitialType]);

  useEffect(() => {
    function handlePageShow() {
      setType(resolvedInitialType);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [resolvedInitialType]);

  function buildDestination(nextType) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (location) params.set("loc", location);
    params.set("tab", nextType);

    const destination =
      nextType === "events" && action === "/results" ? "/events/results" : action;

    return destination + "?" + params.toString();
  }

  function buildTypeChangeDestination(nextType) {
    const mappedDestination =
      typeChangeHrefMap && typeof typeChangeHrefMap[nextType] === "string"
        ? typeChangeHrefMap[nextType]
        : null;

    if (!mappedDestination) {
      return buildDestination(nextType);
    }

    return mappedDestination;
  }

  function submit() {
    const nextType = availableTypes.includes(type) ? type : resolvedInitialType;

    if (onSubmit) {
      onSubmit({ query, location, type: nextType });
      return;
    }

    router.push(buildDestination(nextType));
  }

  function handleSubmit(event) {
    event.preventDefault();
    submit();
  }

  function selectType(nextValue) {
    const nextType = availableTypes.includes(nextValue)
      ? nextValue
      : resolvedInitialType;

    justChangedType.current = true;
    setType(nextType);

    if (onTypeChange) {
      onTypeChange({ query, location, type: nextType });
      return;
    }

    if (autoSubmitOnTypeChange) {
      if (onSubmit) {
        onSubmit({ query, location, type: nextType });
      } else {
        router.push(buildTypeChangeDestination(nextType));
      }
    }
  }

  function handleTypeClick(nextValue) {
    window.setTimeout(() => {
      if (justChangedType.current) {
        justChangedType.current = false;
        return;
      }

      if (autoSubmitOnTypeChange) {
        selectType(nextValue);
      }
    }, 0);
  }

  return (
    <form
      action={action}
      method="get"
      className={[styles.pill, variant === "hero" ? styles.hero : styles.inline].join(" ")}
      onSubmit={handleSubmit}
    >
      <div className={styles.queryWrap}>
        <span className={"material-icons " + styles.queryIcon}>search</span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search spots, festivals, or towns..."
          autoComplete="off"
          className={styles.queryInput}
          name="q"
        />
      </div>

      <div className={styles.divider} />

      <div className={styles.locationWrap}>
        <span className={"material-icons " + styles.locationIcon}>location_on</span>
        <input
          type="text"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="City or Zip"
          autoComplete="off"
          className={styles.locationInput}
          name="loc"
        />
      </div>

      <div className={styles.divider} />

      <input
        type="hidden"
        name="tab"
        value={availableTypes.includes(type) ? type : resolvedInitialType}
      />

      <div className={styles.actionsGroup}>
        <div className={styles.typeGroup} role="group" aria-label="Search type">
          {typeOptions.map((option) => {
            const className = [
              styles.typeBtn,
              type === option.value ? option.activeClass : "",
            ].join(" ");
            const hasMappedNavigation =
              autoSubmitOnTypeChange &&
              !onSubmit &&
              !onTypeChange &&
              typeChangeHrefMap &&
              typeof typeChangeHrefMap[option.value] === "string";

            if (hasMappedNavigation) {
              return (
                <a
                  key={option.value}
                  href={buildTypeChangeDestination(option.value)}
                  aria-current={type === option.value ? "page" : undefined}
                  className={className}
                  onClick={() => setType(option.value)}
                >
                  <span className={"material-icons " + styles.typeBtnIcon}>
                    {option.icon}
                  </span>
                  {option.label}
                </a>
              );
            }

            return (
              <label
                key={option.value}
                aria-pressed={type === option.value}
                className={className}
              >
                <input
                  type="radio"
                  name="search_type_picker"
                  value={option.value}
                  checked={type === option.value}
                  onClick={() => handleTypeClick(option.value)}
                  onChange={() => selectType(option.value)}
                  className={styles.typeInput}
                />
                <span className={"material-icons " + styles.typeBtnIcon}>
                  {option.icon}
                </span>
                {option.label}
              </label>
            );
          })}
        </div>

        <button type="submit" className={styles.searchBtn}>
          <span className={"material-icons " + styles.searchBtnIcon}>search</span>
          Search
        </button>
      </div>
    </form>
  );
}
