import type { BookDetail } from '@athenaeum/shared';
import { useEffect, useRef } from 'react';
import { CloseButton } from '../../../components/CloseButton/CloseButton.tsx';
import { formatCount } from '../../../lib/format.ts';
import { ChapterDrawerItem } from '../ChapterDrawerItem/ChapterDrawerItem.tsx';
import styles from './ChapterDrawer.module.scss';

export interface ChapterDrawerProps {
  book: BookDetail;
  /** 0-based index of the chapter on screen. */
  current: number;
  onClose(): void;
}

/** The panel that slides in from the right listing every chapter, like atsu's Chapters tab. Escape closes it. */
export function ChapterDrawer({ book, current, onClose }: ChapterDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    currentRef.current?.scrollIntoView?.({ block: 'center' });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={book.title} className={styles.drawer}>
        <header className={styles.head}>
          <h2>{book.title}</h2>
          <CloseButton ref={closeRef} onClick={onClose} />
        </header>
        <p className={styles.sub}>
          {book.chapterCount} chapters · {formatCount(book.wordCount)} words
        </p>
        <ol className={styles.list}>
          {book.chapters.map((chapter) => (
            <ChapterDrawerItem
              key={chapter.index}
              bookId={book.id}
              chapter={chapter}
              current={chapter.index === current}
              linkRef={chapter.index === current ? currentRef : undefined}
              onPick={onClose}
            />
          ))}
        </ol>
      </div>
    </>
  );
}
