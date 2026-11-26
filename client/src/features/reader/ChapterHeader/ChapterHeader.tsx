import { formatCount, readingMinutes } from '../../../lib/format.ts';
import styles from './ChapterHeader.module.scss';

export interface ChapterHeaderProps {
  title: string;
  wordCount: number;
}

/** The chapter title with "N words · M min" under it. */
export function ChapterHeader({ title, wordCount }: ChapterHeaderProps) {
  return (
    <header className={styles.header}>
      <h1>{title}</h1>
      <p className={styles.meta}>
        {formatCount(wordCount)} words · {readingMinutes(wordCount)} min
      </p>
    </header>
  );
}
