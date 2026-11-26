import { DEFAULT_READER_SETTINGS } from '@athenaeum/shared';
import { useState } from 'react';
import { useParams } from 'react-router';
import { useBook, useChapter } from '../../../api/books.ts';
import { ButtonLink } from '../../../components/Button/Button.tsx';
import { EmptyState } from '../../../components/EmptyState/EmptyState.tsx';
import { PageSkeleton } from '../../../components/PageSkeleton/PageSkeleton.tsx';
import { ChapterDrawer } from '../ChapterDrawer/ChapterDrawer.tsx';
import { ChapterView } from '../ChapterView/ChapterView.tsx';
import { ReaderToolbar } from '../ReaderToolbar/ReaderToolbar.tsx';
import { readerStyle } from '../readerStyle.ts';
import { useChapterArrowKeys } from '../useChapterArrowKeys.ts';
import { usePrefetchNextChapter } from '../usePrefetchNextChapter.ts';
import { useReadingProgress } from '../useReadingProgress.ts';
import styles from './ReaderPage.module.scss';

/** "3" → 2; anything that isn't a whole number → -1. URLs are 1-based, indexes 0-based. */
const indexFromParam = (param: string) => (Number.isInteger(Number(param)) ? Number(param) - 1 : -1);

/** /read/:id/:chapter — the full-screen reader. */
export function ReaderPage() {
  const { id = '', chapter = '' } = useParams();
  const index = indexFromParam(chapter);
  const book = useBook(id);
  const count = book.data?.chapterCount ?? 0;
  const inRange = !!book.data && index >= 0 && index < count;
  const ch = useChapter(id, index, inRange);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { finishChapter } = useReadingProgress({ bookId: id, book: book.data, chapter: ch.data, index });
  usePrefetchNextChapter(id, index, count, inRange);
  useChapterArrowKeys({ bookId: id, index, hasPrev: inRange && index > 0, hasNext: inRange && index < count - 1, onLeaveForward: finishChapter });

  return (
    <div className={styles.reader} style={readerStyle(DEFAULT_READER_SETTINGS)}>
      <ReaderToolbar bookId={id} canOpenChapters={!!book.data} onOpenChapters={() => setDrawerOpen(true)} />

      {book.isError ? (
        <EmptyState
          message="This book couldn't be opened. It may have been deleted."
          action={<ButtonLink to="/">Back to shelf</ButtonLink>}
        />
      ) : book.data && !inRange ? (
        <EmptyState message={`This book has no chapter ${chapter}.`} action={<ButtonLink to={`/read/${id}/1`}>Go to chapter 1</ButtonLink>} />
      ) : book.data && ch.data ? (
        <ChapterView book={book.data} chapter={ch.data} onFinish={finishChapter} />
      ) : (
        <div className={styles.column}>
          <PageSkeleton label="Loading chapter" />
        </div>
      )}

      {drawerOpen && book.data && <ChapterDrawer book={book.data} current={index} onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}
