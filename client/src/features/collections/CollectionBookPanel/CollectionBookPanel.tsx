import { useBook } from '../../../api/books.ts';
import { BookDetails } from '../../../components/BookDetails/BookDetails.tsx';
import { EmptyState } from '../../../components/EmptyState/EmptyState.tsx';
import { PageSkeleton } from '../../../components/PageSkeleton/PageSkeleton.tsx';

export interface CollectionBookPanelProps {
  bookId: string;
}

/** The selected tab's content: that book's full details, one heading level down. */
export function CollectionBookPanel({ bookId }: CollectionBookPanelProps) {
  const book = useBook(bookId);
  if (book.isPending) return <PageSkeleton label="Loading book" />;
  if (book.isError || !book.data) return <EmptyState message="This book couldn't be loaded." />;
  return <BookDetails book={book.data} headingLevel={2} />;
}
