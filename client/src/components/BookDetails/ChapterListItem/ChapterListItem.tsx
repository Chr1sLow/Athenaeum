import type { ChapterSummary } from '@athenaeum/shared';
import { Check } from 'lucide-react';
import { Link } from 'react-router';
import { formatCount, readingMinutes } from '../../../lib/format.ts';
import styles from './ChapterListItem.module.scss';

export interface ChapterListItemProps {
  bookId: string;
  chapter: ChapterSummary;
  /** The chapter you're reading now. */
  current: boolean;
  onToggleRead(read: boolean): void;
}

/** One chapter row, like atsu's: title on the left, length and a "read" checkbox on the right. */
export function ChapterListItem({ bookId, chapter, current, onToggleRead }: ChapterListItemProps) {
  return (
    <li className={`${styles.row} ${chapter.read ? styles.isRead : ''}`}>
      <Link to={`/read/${bookId}/${chapter.index + 1}`} className={styles.link} aria-current={current ? 'step' : undefined}>
        <span data-title className={styles.title}>
          {chapter.title}
        </span>
        <span className={styles.meta}>
          {current && <span className={styles.reading}>Reading</span>}
          {formatCount(chapter.wordCount)} words · {readingMinutes(chapter.wordCount)} min
        </span>
      </Link>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={chapter.read}
          onChange={(e) => onToggleRead(e.target.checked)}
          aria-label={`Mark “${chapter.title}” as read`}
        />
        <span aria-hidden>
          <Check size={14} />
        </span>
      </label>
    </li>
  );
}
