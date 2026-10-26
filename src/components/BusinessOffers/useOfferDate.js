"use client";

import { useEffect, useState } from "react";
import { getOfferDateKey } from "@/lib/business-offers";

export default function useOfferDate(initialToday) {
  const [today, setToday] = useState(() => initialToday || getOfferDateKey());
  useEffect(() => {
    const update = () => setToday(getOfferDateKey());
    update();
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  return today;
}
