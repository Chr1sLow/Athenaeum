import type { BookSummary } from '@athenaeum/shared';
import { GeneratedCover, type GeneratedCoverProps } from '../GeneratedCover/GeneratedCover.tsx';
import styles from './BookCover.module.scss';

export interface BookCoverProps {
  book: Pick<BookSummary, 'id' | 'title' | 'hasCover'>;
  size?: GeneratedCoverProps['size'];
  /** The title is already shown next to the cover, so screen readers can skip the image. */
  decorative?: boolean;
}

/** A book's cover image, or a generated one when the book has none. It fills its container. */
export function BookCover({ book, size = 'large', decorative }: BookCoverProps) {
  if (!book.hasCover) return <GeneratedCover title={book.title} size={size} />;
  return (
    <img
      className={styles.image}
      src={`/api/books/${book.id}/cover`}
      alt={decorative ? '' : `Cover of ${book.title}`}
      loading="lazy"
    />
  );
}
