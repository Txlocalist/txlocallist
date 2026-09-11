import { useMemo, useSyncExternalStore } from "react";
const subscribe = (notify) => { window.addEventListener("popstate", notify); return () => window.removeEventListener("popstate", notify); };
const snapshot = () => window.location.href;
// Match Next's integration of the native History API with useSearchParams.
for (const method of ["pushState", "replaceState"]) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args) => {
    original(...args);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
}
const router = {
  push(url) { (window.serverNavigations ||= []).push(url); window.history.pushState({}, "", url); },
  replace(url) { (window.serverNavigations ||= []).push(url); window.history.replaceState({}, "", url); },
  refresh() { window.dispatchEvent(new PopStateEvent("popstate")); },
};
export const useRouter = () => router;
export function useSearchParams() { const href = useSyncExternalStore(subscribe, snapshot); return useMemo(() => new URL(href).searchParams, [href]); }
export function usePathname() { return new URL(useSyncExternalStore(subscribe, snapshot)).pathname; }
