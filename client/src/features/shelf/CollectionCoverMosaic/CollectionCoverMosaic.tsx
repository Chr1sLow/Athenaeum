import type { CollectionSummary } from '@athenaeum/shared';
import { Library } from 'lucide-react';
import { BookCover } from '../../../components/BookCover/BookCover.tsx';
import styles from './CollectionCoverMosaic.module.scss';

export interface CollectionCoverMosaicProps {
  books: CollectionSummary['previewBooks'];
}

/** A square 2×2 mosaic of the first covers in a collection, so collections read differently from single books. */
export function CollectionCoverMosaic({ books }: CollectionCoverMosaicProps) {
  if (!books.length) {
    return (
      <div className={`${styles.mosaic} ${styles.empty}`}>
        <Library size={32} strokeWidth={1.5} aria-hidden />
      </div>
    );
  }
  return (
    <div className={styles.mosaic} data-count={books.length}>
      {books.map((book) => (
        <BookCover key={book.id} book={book} size="small" />
      ))}
    </div>
  );
}
