import { type RefObject, useEffect } from 'react';

/** Ctrl/⌘ + `key` focuses the referenced input (like atsu.moe's Ctrl K search). */
export function useFocusShortcut(ref: RefObject<HTMLInputElement | null>, key: string) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === key && ref.current) {
        e.preventDefault();
        ref.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ref, key]);
}
