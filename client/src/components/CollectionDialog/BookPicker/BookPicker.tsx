import type { BookSummary } from '@athenaeum/shared';
import { useState } from 'react';
import { SearchField } from '../../SearchField/SearchField.tsx';
import { BookPickerItem } from '../BookPickerItem/BookPickerItem.tsx';
import styles from './BookPicker.module.scss';

export interface BookPickerProps {
  books: BookSummary[];
  selected: ReadonlySet<string>;
  onToggle(bookId: string): void;
}

function matching(books: BookSummary[], filter: string) {
  const q = filter.trim().toLowerCase();
  return q ? books.filter((b) => b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q)) : books;
}

/** A filterable checklist of the shelf's books, with a "N selected" count. */
export function BookPicker({ books, selected, onToggle }: BookPickerProps) {
  const [filter, setFilter] = useState('');
  const visible = matching(books, filter);

  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <span className={styles.label}>Books</span>
        <span className={styles.count}>{selected.size} selected</span>
      </div>
      <SearchField label="Filter books" placeholder="Filter books" value={filter} onChange={setFilter} />
      <ul className={styles.list}>
        {visible.map((book) => (
          <BookPickerItem key={book.id} book={book} checked={selected.has(book.id)} onToggle={() => onToggle(book.id)} />
        ))}
        {visible.length === 0 && <li className={styles.none}>No books match.</li>}
      </ul>
    </div>
  );
}
