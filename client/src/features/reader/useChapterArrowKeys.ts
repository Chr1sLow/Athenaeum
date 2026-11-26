import { useEffect } from 'react';
import { useNavigate } from 'react-router';

interface ChapterArrowKeysOptions {
  bookId: string;
  /** 0-based index of the chapter on screen. */
  index: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** Called before moving on to the next chapter (marks this one read). */
  onLeaveForward(): void;
}

/**
 * → opens the next chapter and ← the previous one, unless you're typing, holding a modifier, or a
 * dialog is open (the image viewer uses the arrows itself).
 */
export function useChapterArrowKeys({ bookId, index, hasPrev, hasNext, onLeaveForward }: ChapterArrowKeysOptions) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.key === 'ArrowRight' && hasNext) {
        onLeaveForward();
        navigate(`/read/${bookId}/${index + 2}`);
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        navigate(`/read/${bookId}/${index}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasNext, hasPrev, bookId, index, navigate, onLeaveForward]);
}
