import type { Block } from '@athenaeum/shared';
import styles from './ChapterNotes.module.scss';

export type NoteBlock = Extract<Block, { type: 'note' }>;

export interface ChapterNotesProps {
  /** The chapter's notes, each with its index among the chapter's blocks. */
  notes: { block: NoteBlock; index: number }[];
}

/**
 * A chapter's footnotes, listed after its text under a short rule, like the foot of a printed
 * page. Each note keeps `data-block` so reading progress works here too. `html` is built by the
 * server's importer from escaped text and an allow-list of inline tags, so it is safe to insert.
 */
export function ChapterNotes({ notes }: ChapterNotesProps) {
  return (
    <section className={styles.notes} aria-label="Notes">
      <ol className={styles.list}>
        {notes.map(({ block, index }) => (
          <li key={index} data-block={index} className={styles.note}>
            <span className={styles.label}>{block.label}</span>{' '}
            {block.html ? <span dangerouslySetInnerHTML={{ __html: block.html }} /> : block.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
