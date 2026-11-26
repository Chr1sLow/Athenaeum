import type { ChapterSummary } from '@athenaeum/shared';
import { Check } from 'lucide-react';
import type { Ref } from 'react';
import { Link } from 'react-router';
import styles from './ChapterDrawerItem.module.scss';

export interface ChapterDrawerItemProps {
  bookId: string;
  chapter: ChapterSummary;
  /** The chapter on screen: outlined, and marked as the current page. */
  current: boolean;
  linkRef?: Ref<HTMLAnchorElement>;
  /** Called when the row is clicked (closes the drawer). */
  onPick(): void;
}

/** One row in the chapter drawer: the title, and a check mark once read. */
export function ChapterDrawerItem({ bookId, chapter, current, linkRef, onPick }: ChapterDrawerItemProps) {
  return (
    <li>
      <Link
        ref={linkRef}
        to={`/read/${bookId}/${chapter.index + 1}`}
        aria-current={current ? 'page' : undefined}
        className={styles.row}
        onClick={onPick}
      >
        <span className={styles.title}>{chapter.title}</span>
        {chapter.read && (
          <span role="img" aria-label="Read" className={styles.readMark}>
            <Check size={14} />
          </span>
        )}
      </Link>
    </li>
  );
}
