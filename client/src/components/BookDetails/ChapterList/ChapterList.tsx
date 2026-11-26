import type { BookDetail, ChapterSummary } from '@athenaeum/shared';
import { useId, useState } from 'react';
import { useMarkRead } from '../../../api/books.ts';
import { ChapterListItem } from '../ChapterListItem/ChapterListItem.tsx';
import { type ChapterFilter, ChapterListToolbar } from '../ChapterListToolbar/ChapterListToolbar.tsx';
import styles from './ChapterList.module.scss';

export interface ChapterListProps {
  book: BookDetail;
  headingLevel: 2 | 3;
}

function visibleChapters(chapters: ChapterSummary[], filter: ChapterFilter, query: string, newestFirst: boolean) {
  const q = query.trim().toLowerCase();
  const list = chapters.filter(
    (c) => (filter === 'all' || (filter === 'read') === c.read) && (!q || c.title.toLowerCase().includes(q)),
  );
  return newestFirst ? list.reverse() : list;
}

/** The book's chapters with search, a read/unread filter, sort order and a "read" checkbox per row. */
export function ChapterList({ book, headingLevel }: ChapterListProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const headingId = useId();
  const [filter, setFilter] = useState<ChapterFilter>('all');
  const [newestFirst, setNewestFirst] = useState(false);
  const [query, setQuery] = useState('');
  const markRead = useMarkRead(book.id);
  const currentIndex = book.progress ? book.chapterIndex : -1;
  const shown = visibleChapters(book.chapters, filter, query, newestFirst);

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <Heading id={headingId} className={styles.heading}>
        Chapters
      </Heading>

      <ChapterListToolbar
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        newestFirst={newestFirst}
        onNewestFirstChange={setNewestFirst}
      />

      {shown.length === 0 ? (
        <p className={styles.none}>No chapters match.</p>
      ) : (
        <ol className={styles.list} aria-label="Chapters">
          {shown.map((chapter) => (
            <ChapterListItem
              key={chapter.index}
              bookId={book.id}
              chapter={chapter}
              current={chapter.index === currentIndex}
              onToggleRead={(read) => markRead.mutate({ index: chapter.index, read })}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
