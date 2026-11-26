import type { BookDetail } from '@athenaeum/shared';
import { PageHeading } from '../PageHeading/PageHeading.tsx';
import { BookFacts } from './BookFacts/BookFacts.tsx';
import { BookSidebar } from './BookSidebar/BookSidebar.tsx';
import { BookStats } from './BookStats/BookStats.tsx';
import { ChapterList } from './ChapterList/ChapterList.tsx';
import styles from './BookDetails.module.scss';

export interface BookDetailsProps {
  book: BookDetail;
  /** 1 on the book's own page; 2 inside another page (a collection tab). */
  headingLevel?: 1 | 2;
}

/**
 * Everything about one book, modeled on atsu.moe's novel page: serif title, cover and actions on
 * the left, stats, facts, description and chapters on the right.
 */
export function BookDetails({ book, headingLevel = 1 }: BookDetailsProps) {
  return (
    <article className={styles.details}>
      <PageHeading title={book.title} level={headingLevel} size={headingLevel === 1 ? 'large' : 'medium'} />
      <div className={styles.layout}>
        <BookSidebar book={book} />
        <div className={styles.main}>
          <BookStats book={book} />
          <BookFacts book={book} />
          {book.description && <p className={styles.description}>{book.description}</p>}
          <ChapterList book={book} headingLevel={headingLevel === 1 ? 2 : 3} />
        </div>
      </div>
    </article>
  );
}
