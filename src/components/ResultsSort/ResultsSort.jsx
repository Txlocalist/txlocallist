"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { normalizeSort, SORT_OPTIONS } from "@/lib/results-sort";
import styles from "./ResultsSort.module.css";

export default function ResultsSort({ value, onChange, fallback = "newest", saved = false, events = false, popular = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const extras = [...(events ? ["upcoming"] : []), ...(popular ? ["popular"] : [])];
  const selected = normalizeSort(value ?? params.get("sort"), fallback, extras);
  function change(next) {
    if (onChange) return onChange(next);
    const query = new URLSearchParams(params.toString());
    query.set("sort", next);
    query.delete("page");
    router.push(`${pathname}?${query}`, { scroll: false });
  }
  return (
    <label className={styles.control}>
      <span>Sort by</span>
      <select value={selected} onChange={(event) => change(event.target.value)}>
        {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{saved && ["newest", "oldest"].includes(option.value) ? `${option.label} saved` : option.label}</option>)}
        {events && <option value="upcoming">Upcoming</option>}
        {popular && <option value="popular">Most saved</option>}
      </select>
    </label>
  );
}
