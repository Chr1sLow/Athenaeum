import type { ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './PaneLink.module.scss';

export interface PaneLinkProps {
  to: string;
  /** `page` for the table being shown, `true` for the open row. */
  current?: 'page' | true;
  /** Shown in a monospace font, like ids in the Firestore console. */
  children: ReactNode;
  /** Muted text at the right end (a row count) or under the name (a row's title). */
  detail?: ReactNode;
  detailPosition?: 'end' | 'below';
}

/** One entry in a pane's list: a table or a row. The current one is highlighted. */
export function PaneLink({ to, current, children, detail, detailPosition = 'end' }: PaneLinkProps) {
  return (
    <Link
      to={to}
      className={detailPosition === 'below' ? `${styles.link} ${styles.stacked}` : styles.link}
      aria-current={current}
    >
      <span className={styles.name}>{children}</span>
      {detail !== undefined && <span className={styles.detail}>{detail}</span>}
    </Link>
  );
}
