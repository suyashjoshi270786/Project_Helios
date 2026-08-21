import { useEffect, type RefObject } from "react";

// A "fixed inset-0" overlay for closing dropdowns breaks whenever an ancestor
// has a CSS transform (e.g. the sidebar's slide-in animation) — the overlay
// becomes fixed to that ancestor's box instead of the viewport. Listening on
// document directly avoids that trap entirely.
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [active, onOutside, ref]);
}
