"use client";

import { useRouter } from "next/navigation";
import styles from "./CategoryPills.module.css";

/**
 * Horizontal scrollable row of quick-search category pills.
 * Clicking a pill navigates to /results with the category pre-filled.
 *
 * Props:
 *   type  – "businesses" | "events"  (default "businesses")
 *           Sets which tab opens on the results page.
 *   initialLocation – pass the current city so the search is scoped.
 */

const BUSINESS_CATEGORIES = [
  { label: "Food & Drink",  icon: "restaurant",   q: "food"    },
  { label: "Retail",        icon: "shopping_bag",  q: "retail"  },
  { label: "Coffee",        icon: "coffee",        q: "coffee"  },
  { label: "Beauty",        icon: "spa",           q: "beauty"  },
  { label: "Fitness",       icon: "fitness_center", q: "fitness" },
];

const EVENT_CATEGORIES = [
  { label: "Live Music",    icon: "music_note",   q: "music"    },
  { label: "Food & Drink",  icon: "restaurant",   q: "food"     },
  { label: "Outdoors",      icon: "park",         q: "outdoor"  },
  { label: "Festivals",     icon: "celebration",  q: "festival" },
  { label: "Art & Culture", icon: "palette",      q: "art"      },
];

export default function CategoryPills({ type = "businesses", initialLocation = "" }) {
  const router = useRouter();
  const categories = type === "events" ? EVENT_CATEGORIES : BUSINESS_CATEGORIES;

  function handleClick(q) {
    const params = new URLSearchParams();
    params.set("q", q);
    if (initialLocation) params.set("loc", initialLocation);
    params.set("tab", type);
    router.push((type === "events" ? "/events/results" : "/results") + "?" + params.toString());
  }

  return (
    <div className={styles.wrapper}>
      {categories.map((cat) => (
        <button
          key={cat.label}
          type="button"
          onClick={() => handleClick(cat.q)}
          className={styles.pill}
        >
          <span className={"material-icons " + styles.pillIcon}>{cat.icon}</span>
          {cat.label}
        </button>
      ))}
    </div>
  );
}
