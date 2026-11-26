import styles from './GeneratedCover.module.scss';

/** Background for a book with no cover image. Same title → same colors, so it never changes. */
export function coverGradient(title: string): string {
  let hue = 0;
  for (const ch of title) hue = (hue * 31 + ch.codePointAt(0)!) % 360;
  return `linear-gradient(160deg, hsl(${hue} 32% 30%), hsl(${(hue + 40) % 360} 38% 16%))`;
}

export interface GeneratedCoverProps {
  title: string;
  /** `large`: cover card / book page. `small`: a tile in a collection mosaic. `tiny`: a thumbnail (first letter only). */
  size?: 'large' | 'small' | 'tiny';
}

/** A colored stand-in cover showing the book's title. It fills its container. */
export function GeneratedCover({ title, size = 'large' }: GeneratedCoverProps) {
  return (
    <div className={`${styles.cover} ${styles[size]}`} data-testid="generated-cover" style={{ background: coverGradient(title) }}>
      {size === 'large' && <span className={styles.rule} aria-hidden />}
      <span className={styles.title}>{size === 'tiny' ? title.charAt(0) : title}</span>
      {size === 'large' && <span className={styles.rule} aria-hidden />}
    </div>
  );
}
