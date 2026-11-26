import type { BookSummary } from '@athenaeum/shared';
import { useId } from 'react';
import { CardGrid } from '../../../components/CardGrid/CardGrid.tsx';
import { PageHeading } from '../../../components/PageHeading/PageHeading.tsx';
import { BookCard } from '../BookCard/BookCard.tsx';
import styles from './PinnedSection.module.scss';

export interface PinnedSectionProps {
  /** The pinned books, in shelf order. They stay on the shelf below as well. */
  books: BookSummary[];
}

/** The "Pinned" row at the top of the shelf, above the collections. */
export function PinnedSection({ books }: PinnedSectionProps) {
  const headingId = useId();

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <PageHeading level={2} size="section" title="Pinned" titleId={headingId} />
      {books.length === 0 && (
        <p className={styles.hint}>Pin your favourite novels here for easy access.</p>
      )}
      <CardGrid>
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </CardGrid>
    </section>
  );
}
