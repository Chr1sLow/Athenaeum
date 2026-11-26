import type { BookSummary } from '@athenaeum/shared';
import { BookCover } from '../../BookCover/BookCover.tsx';
import styles from './BookPickerItem.module.scss';

export interface BookPickerItemProps {
  book: BookSummary;
  checked: boolean;
  onToggle(): void;
}

/** One checkable book in the picker: checkbox, thumbnail, title and author. */
export function BookPickerItem({ book, checked, onToggle }: BookPickerItemProps) {
  return (
    <li>
      <label className={styles.item}>
        <input type="checkbox" aria-label={book.title} checked={checked} onChange={onToggle} />
        <span className={styles.thumb}>
          <BookCover book={book} size="tiny" decorative />
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{book.title}</span>
          {book.author && <span className={styles.author}>{book.author}</span>}
        </span>
      </label>
    </li>
  );
}
