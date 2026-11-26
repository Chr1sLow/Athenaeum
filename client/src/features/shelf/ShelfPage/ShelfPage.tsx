import { BookOpen } from 'lucide-react';
import { useBooks } from '../../../api/books.ts';
import { CardGrid } from '../../../components/CardGrid/CardGrid.tsx';
import { EmptyState } from '../../../components/EmptyState/EmptyState.tsx';
import { PageHeading } from '../../../components/PageHeading/PageHeading.tsx';
import { PageSkeleton } from '../../../components/PageSkeleton/PageSkeleton.tsx';
import { UploadButton } from '../../../components/UploadButton/UploadButton.tsx';
import { useUploads } from '../../../components/UploadProvider/UploadProvider.tsx';
import { useDocumentTitle } from '../../../lib/useDocumentTitle.ts';
import { useFileDrop } from '../../../lib/useFileDrop.ts';
import { BookCard } from '../BookCard/BookCard.tsx';
import { CollectionsSection } from '../CollectionsSection/CollectionsSection.tsx';
import { DropOverlay } from '../DropOverlay/DropOverlay.tsx';
import styles from './ShelfPage.module.scss';

/** The home page: your collections, then every book. Drop files anywhere to add them. */
export function ShelfPage() {
  const books = useBooks();
  const uploads = useUploads();
  const { dragging, dropHandlers } = useFileDrop(uploads.addFiles);
  useDocumentTitle();
  const list = books.data ?? [];

  /** Pinned books */
  const pinnedBooks = list.filter((book) => book.pinned);

  /** Unpinned books */
  const unPinnedBooks = list.filter((book) => !book.pinned);

  return (
    <div className={styles.page} {...dropHandlers}>
      {list.length > 0 && <CollectionsSection />}

      <PageHeading 
        title="Your Shelf"
        size="section"
        actions={<UploadButton />}
      />

      {books.isPending && <PageSkeleton label="Loading your shelf" />}

      {books.isSuccess && list.length === 0 && (
        <EmptyState
          variant="outlined"
          icon={<BookOpen size={40} strokeWidth={1.5} />}
          title="Your shelf is empty"
          message="Add an EPUB or PDF to start reading. You can also drop files anywhere on this page."
          action={<UploadButton />}
        />
      )}

      {list.length > 0 && (
        <CardGrid>
          {pinnedBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}

          {unPinnedBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </CardGrid>
      )}

      {dragging && <DropOverlay />}
    </div>
  );
}
