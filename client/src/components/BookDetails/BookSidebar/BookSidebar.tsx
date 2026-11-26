import type { BookDetail } from '@athenaeum/shared';
import { BookOpen, Download } from 'lucide-react';
import { BookCover } from '../../BookCover/BookCover.tsx';
import { ButtonAnchor, ButtonLink } from '../../Button/Button.tsx';
import styles from './BookSidebar.module.scss';

export interface BookSidebarProps {
  book: BookDetail;
}

/** The cover with "Start reading" / "Continue: …" and "Download original" under it. */
export function BookSidebar({ book }: BookSidebarProps) {
  const current = book.chapters[book.chapterIndex];
  const readLabel = book.progress !== null && current ? `Continue: ${current.title}` : 'Start reading';

  return (
    <aside className={styles.sidebar}>
      <div className={styles.cover}>
        <BookCover book={book} />
      </div>
      <ButtonLink
        to={`/read/${book.id}/${book.chapterIndex + 1}`}
        variant="primary"
        fullWidth
        icon={<BookOpen size={18} />}
        iconPosition="end"
      >
        {readLabel}
      </ButtonLink>
      <ButtonAnchor
        href={`/api/books/${book.id}/file`}
        download={book.filename}
        fullWidth
        icon={<Download size={18} />}
        iconPosition="end"
      >
        Download original
      </ButtonAnchor>
    </aside>
  );
}
