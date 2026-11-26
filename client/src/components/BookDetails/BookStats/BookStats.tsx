import type { BookDetail } from '@athenaeum/shared';
import { Fragment } from 'react';
import { formatCount } from '../../../lib/format.ts';
import styles from './BookStats.module.scss';

export interface BookStatsProps {
  book: Pick<BookDetail, 'chapterCount' | 'wordCount' | 'percent'>;
}

/** "3 chapters • 2,400 words • 45% read". */
export function BookStats({ book }: BookStatsProps) {
  const stats = [`${formatCount(book.chapterCount)} chapters`, `${formatCount(book.wordCount)} words`];
  if (book.percent > 0) stats.push(`${Math.max(1, Math.round(book.percent))}% read`);

  return (
    <p className={styles.stats}>
      {stats.map((stat, i) => (
        <Fragment key={stat}>
          {i > 0 && <span aria-hidden>•</span>}
          <span>{stat}</span>
        </Fragment>
      ))}
    </p>
  );
}
