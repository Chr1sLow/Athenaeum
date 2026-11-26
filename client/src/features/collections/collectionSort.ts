import type { CollectionBook } from '@athenaeum/shared';

export type CollectionSort = 'added' | 'title';

export const COLLECTION_SORT_OPTIONS = [
  { value: 'added', label: 'Date added' },
  { value: 'title', label: 'A–Z' },
] as const;

const byTitle = (a: CollectionBook, b: CollectionBook) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
const byAdded = (a: CollectionBook, b: CollectionBook) => b.addedToCollectionAt.localeCompare(a.addedToCollectionAt);

/** Newest-added first, or A–Z by title (ignoring case, "Book 2" before "Book 10"). */
export function sortCollectionBooks(books: CollectionBook[], sort: CollectionSort): CollectionBook[] {
  return [...books].sort(sort === 'title' ? byTitle : byAdded);
}
