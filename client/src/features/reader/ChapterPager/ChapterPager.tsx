import type { ChapterSummary } from '@athenaeum/shared';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import styles from './ChapterPager.module.scss';

export interface ChapterPagerProps {
  bookId: string;
  chapters: ChapterSummary[];
  /** 0-based index of the chapter on screen. */
  index: number;
  /** Marks the chapter read when you move on. */
  onFinish(): void;
}

/** "Previous chapter" and "Next chapter" cards under the text, or "You've reached the end". */
export function ChapterPager({ bookId, chapters, index, onFinish }: ChapterPagerProps) {
  const prev = chapters[index - 1];
  const next = chapters[index + 1];

  return (
    <nav className={styles.pager} aria-label="Chapter navigation">
      {prev ? (
        <Link to={`/read/${bookId}/${index}`} className={styles.card}>
          <span className={styles.label}>
            <ArrowLeft size={14} aria-hidden /> Previous chapter
          </span>
          <span className={styles.title}>{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to={`/read/${bookId}/${index + 2}`} className={`${styles.card} ${styles.next}`} onClick={onFinish}>
          <span className={styles.label}>
            Next chapter <ArrowRight size={14} aria-hidden />
          </span>
          <span className={styles.title}>{next.title}</span>
        </Link>
      ) : (
        <div className={`${styles.card} ${styles.next}`}>
          <span className={styles.label}>You've reached the end</span>
          <Link to="/" className={styles.title} onClick={onFinish}>
            Back to shelf
          </Link>
        </div>
      )}
    </nav>
  );
}
