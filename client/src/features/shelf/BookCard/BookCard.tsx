import type { BookSummary } from '@athenaeum/shared';
import { Link } from 'react-router';
import { BookCover } from '../../../components/BookCover/BookCover.tsx';
import { ProgressBar } from '../../../components/ProgressBar/ProgressBar.tsx';
import { BookCardMenu } from '../BookCardMenu/BookCardMenu.tsx';
import styles from './BookCard.module.scss';

export interface BookCardProps {
  book: BookSummary;
}

/** A book on the shelf, like atsu.moe's cover cards: cover with format and progress chips, title, author, last read. */
export function BookCard({ book }: BookCardProps) {
  const percent = book.percent > 0 ? `${Math.max(1, Math.round(book.percent))}%` : null;

  return (
    <article className={styles.card}>
      <Link to={`/book/${book.id}`} className={styles.link}>
        <div className={styles.cover}>
          <BookCover book={book} />
          <div className={styles.chips}>
            <span className={`${styles.chip} ${styles[book.format]}`}>{book.format.toUpperCase()}</span>
            {percent && <span className={styles.chip}>{percent}</span>}
          </div>
          {book.percent > 0 && <ProgressBar value={book.percent} variant="overlay" />}
        </div>
        <h3 className={styles.title}>{book.title}</h3>
      </Link>
      {/* Beside the link, not inside it: a button inside a link is invalid and would also navigate. */}
      <div className={styles.menu}>
        <BookCardMenu book={book} />
      </div>
      {book.author && <p className={styles.author}>{book.author}</p>}
    </article>
  );
}
