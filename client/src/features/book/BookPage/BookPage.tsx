import { useParams } from 'react-router';
import { useBook } from '../../../api/books.ts';
import { BookDetails } from '../../../components/BookDetails/BookDetails.tsx';
import { ButtonLink } from '../../../components/Button/Button.tsx';
import { EmptyState } from '../../../components/EmptyState/EmptyState.tsx';
import { PageSkeleton } from '../../../components/PageSkeleton/PageSkeleton.tsx';
import { useDocumentTitle } from '../../../lib/useDocumentTitle.ts';

/** /book/:id */
export function BookPage() {
  const { id = '' } = useParams();
  const book = useBook(id);
  useDocumentTitle(book.data?.title);

  if (book.isPending) return <PageSkeleton label="Loading book" />;
  if (book.isError || !book.data) {
    return <EmptyState message="This book is not on your shelf." action={<ButtonLink to="/">Back to shelf</ButtonLink>} />;
  }

  return <BookDetails book={book.data} />;
}
