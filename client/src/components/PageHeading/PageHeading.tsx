import type { ReactNode } from 'react';
import styles from './PageHeading.module.scss';

export interface PageHeadingProps {
  title: ReactNode;
  level?: 1 | 2;
  /** `large`/`medium`: serif display titles (a book, a collection). `section`: a shelf section like "Your Shelf". */
  size?: 'large' | 'medium' | 'section';
  /** A line under the title, e.g. "3 books". */
  subtitle?: ReactNode;
  /** Buttons on the right. */
  actions?: ReactNode;
  titleId?: string;
}

/** The title row at the top of a page or section: title, optional subtitle, optional actions. */
export function PageHeading({ title, level = 1, size = 'large', subtitle, actions, titleId }: PageHeadingProps) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className={`${styles.root} ${styles[size]}`}>
      <div className={styles.text}>
        <Heading id={titleId} className={styles.title}>
          {title}
        </Heading>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
