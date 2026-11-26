import type { Block } from '@athenaeum/shared';
import { ChapterNotes, type NoteBlock } from '../ChapterNotes/ChapterNotes.tsx';
import styles from './ChapterBody.module.scss';

export interface ChapterBodyProps {
  bookId: string;
  blocks: Block[];
}

/**
 * The chapter text: paragraphs, headings, scene breaks and images, then any footnotes, each tagged with
 * `data-block={index}` for scroll tracking. `html` comes from the server's importer, which builds
 * it from an allow-list of inline tags (em, strong, i, b, sup, sub, small, u, s, br) with all text
 * escaped and no attributes, so it is safe to insert.
 */
export function ChapterBody({ bookId, blocks }: ChapterBodyProps) {
  const notes = blocks.flatMap((block, index) => (block.type === 'note' ? [{ block: block as NoteBlock, index }] : []));
  return (
    <div className={styles.body}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'note':
            return null; // listed together at the end, below

          case 'p':
            return b.html ? (
              <p key={i} data-block={i} dangerouslySetInnerHTML={{ __html: b.html }} />
            ) : (
              <p key={i} data-block={i}>
                {b.text}
              </p>
            );
          case 'h': {
            const Tag = b.level === 2 ? 'h2' : b.level === 3 ? 'h3' : 'h4';
            return (
              <Tag key={i} data-block={i}>
                {b.text}
              </Tag>
            );
          }
          case 'hr':
            return <hr key={i} data-block={i} />;
          case 'img':
            return (
              <figure key={i} data-block={i}>
                <img src={`/api/books/${bookId}/images/${b.imageId}`} alt={b.alt ?? ''} loading="lazy" />
              </figure>
            );
        }
      })}
      {notes.length > 0 && <ChapterNotes notes={notes} />}
    </div>
  );
}
