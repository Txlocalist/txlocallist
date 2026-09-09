import { useMemo, useSyncExternalStore } from "react";
const subscribe = (notify) => { window.addEventListener("popstate", notify); return () => window.removeEventListener("popstate", notify); };
const snapshot = () => window.location.href;
const router = {
  push(url) { window.history.pushState({}, "", url); window.dispatchEvent(new PopStateEvent("popstate")); },
  replace(url) { window.history.replaceState({}, "", url); window.dispatchEvent(new PopStateEvent("popstate")); },
  refresh() { window.dispatchEvent(new PopStateEvent("popstate")); },
};
export const useRouter = () => router;
export function useSearchParams() { const href = useSyncExternalStore(subscribe, snapshot); return useMemo(() => new URL(href).searchParams, [href]); }
export function usePathname() { return new URL(useSyncExternalStore(subscribe, snapshot)).pathname; }
