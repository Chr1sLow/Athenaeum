import type { BookDetail, Chapter } from '@athenaeum/shared';
import { useCallback, useEffect, useRef } from 'react';
import { useMarkRead, useSaveProgress } from '../../api/books.ts';

const SAVE_DELAY_MS = 1500;
/** A block counts as "where you are" once its bottom edge is below this many pixels from the top. */
const TOP_OFFSET = 72;

interface ReadingProgressOptions {
  bookId: string;
  book: BookDetail | undefined;
  chapter: Chapter | undefined;
  /** 0-based chapter index from the URL. */
  index: number;
}

/**
 * Remembers your place while you read:
 * - when a chapter loads, scrolls back to your saved paragraph (first time only) or to the top;
 * - while you scroll, tracks the paragraph at the top of the screen and saves it after you pause;
 * - marks the chapter read when you reach its end.
 * Returns `finishChapter`, which marks the current chapter read (used by "Next chapter").
 */
export function useReadingProgress({ bookId, book, chapter, index }: ReadingProgressOptions) {
  const count = book?.chapterCount ?? 0;
  // `mutate` functions are stable across renders; the mutation objects themselves are not.
  const { mutate: sendProgress } = useSaveProgress(bookId);
  const { mutate: sendRead } = useMarkRead(bookId);
  // Latest book data for effects that must only re-run when the chapter changes.
  const bookRef = useRef(book);
  bookRef.current = book;
  const blockCount = chapter?.blocks.length ?? 0;

  const position = useRef({ index, block: 0 });
  const pendingSave = useRef<number | null>(null);
  const restored = useRef(false);
  const lastSaved = useRef('');

  const save = useCallback(
    (chapterIndex: number, blockIndex: number, blocks: number) => {
      const key = `${chapterIndex}:${blockIndex}`;
      if (!count || key === lastSaved.current) return;
      lastSaved.current = key;
      const percent = ((chapterIndex + blockIndex / Math.max(1, blocks)) / count) * 100;
      sendProgress({ chapterIndex, blockIndex, percent: Math.min(100, Math.round(percent * 100) / 100) });
    },
    [count, sendProgress],
  );

  const markChapterRead = useCallback(
    (i: number) => {
      if (!bookRef.current?.chapters[i]?.read) sendRead({ index: i, read: true });
    },
    [sendRead],
  );

  const flush = useCallback(() => {
    if (pendingSave.current === null) return;
    window.clearTimeout(pendingSave.current);
    pendingSave.current = null;
    save(position.current.index, position.current.block, blockCount);
  }, [blockCount, save]);

  // When a chapter loads: restore your place (first time only) or start at the top, then save.
  useEffect(() => {
    const bookData = bookRef.current;
    if (!chapter || !bookData || chapter.index !== index) return;
    let block = 0;
    const saved = bookData.progress;
    if (!restored.current && saved && saved.chapterIndex === index && saved.blockIndex > 0) {
      block = Math.min(saved.blockIndex, chapter.blocks.length - 1);
      document.querySelector(`[data-block="${block}"]`)?.scrollIntoView({ block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
    restored.current = true;
    position.current = { index, block };
    save(index, block, chapter.blocks.length);
    document.title = `${chapter.title} · ${bookData.title}`;
  }, [chapter, index, save]);

  // Track the paragraph at the top of the screen while you scroll; save after you pause.
  useEffect(() => {
    if (!chapter) return;
    let readMarked = false;
    const onScroll = () => {
      const els = document.querySelectorAll<HTMLElement>('[data-block]');
      let block = 0;
      for (const el of els) {
        if (el.getBoundingClientRect().bottom > TOP_OFFSET) {
          block = Number(el.dataset.block);
          break;
        }
      }
      position.current = { index, block };
      if (pendingSave.current !== null) window.clearTimeout(pendingSave.current);
      pendingSave.current = window.setTimeout(flush, SAVE_DELAY_MS);

      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 48;
      if (atEnd && !readMarked) {
        readMarked = true;
        markChapterRead(index);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [chapter, index, flush, markChapterRead]);

  const finishChapter = useCallback(() => markChapterRead(index), [index, markChapterRead]);
  return { finishChapter };
}
