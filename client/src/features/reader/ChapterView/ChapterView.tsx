import type { BookDetail, Chapter } from '@athenaeum/shared';
import { ChapterBody } from '../ChapterBody/ChapterBody.tsx';
import { ChapterGallery } from '../ChapterGallery/ChapterGallery.tsx';
import { ChapterHeader } from '../ChapterHeader/ChapterHeader.tsx';
import { ChapterPager } from '../ChapterPager/ChapterPager.tsx';
import styles from './ChapterView.module.scss';

export interface ChapterViewProps {
  book: BookDetail;
  chapter: Chapter;
  /** Marks the chapter read when you move on. */
  onFinish(): void;
}

/** One chapter in the reader's centered column: title and length, the text, then previous / next, plus its gallery button. */
export function ChapterView({ book, chapter, onFinish }: ChapterViewProps) {
  return (
    <article className={styles.chapter}>
      <ChapterHeader title={chapter.title} wordCount={chapter.wordCount} />
      <ChapterBody bookId={book.id} blocks={chapter.blocks} />
      <ChapterPager bookId={book.id} chapters={book.chapters} index={chapter.index} onFinish={onFinish} />
      <ChapterGallery key={chapter.index} bookId={book.id} images={chapter.gallery} />
    </article>
  );
}
