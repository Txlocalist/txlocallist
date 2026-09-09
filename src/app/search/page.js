import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Navbar, Footer } from "@/components";
import { SearchResultsContent } from "./SearchResultsContent";

import styles from "./page.module.css";

export const metadata = {
  title: "Search Businesses | Texas Localist",
  description: "Find local businesses, cafes, shops, and more across Texas.",
};

/**
 * /search — redirects to /results preserving all query params.
 * The canonical search URL is /results; this keeps old links working.
 */
export default async function SearchPage({ searchParams }) {
  const params = await searchParams;

  // If the user landed on /search directly (not rendered as /results),
  // redirect to /results so the address bar shows the right URL.
  const qs = new URLSearchParams();
  if (params.q)        qs.set("q",        params.q);
  if (params.loc)      qs.set("loc",      params.loc);
  if (params.category) qs.set("category", params.category);
  if (params.page)     qs.set("page",     params.page);
  for (const key of ["sort", "tab", "jobs", "browse"]) if (params[key]) qs.set(key, params[key]);

  const dest = `/results${qs.toString() ? `?${qs.toString()}` : ""}`;
  redirect(dest);
}

function SearchPageSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonBar}></div>
      <div className={styles.skeletonGrid}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className={styles.skeletonCard}></div>
        ))}
      </div>
    </div>
  );
}
