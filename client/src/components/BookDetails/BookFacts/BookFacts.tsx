import type { BookDetail } from '@athenaeum/shared';
import styles from './BookFacts.module.scss';

export interface BookFactsProps {
  book: Pick<BookDetail, 'format' | 'chapters' | 'chapterCount' | 'author'>;
}

/** The TYPE / PROGRESS / AUTHOR row between two rules, like atsu's TYPE / STATUS / AUTHOR. */
export function BookFacts({ book }: BookFactsProps) {
  const readCount = book.chapters.filter((c) => c.read).length;
  const facts: [label: string, value: string][] = [
    ['Type', book.format.toUpperCase()],
    ['Progress', `${readCount} / ${book.chapterCount} read`],
  ];
  if (book.author) facts.push(['Author', book.author]);

  return (
    <dl className={styles.facts}>
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
