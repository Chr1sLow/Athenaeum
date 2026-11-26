import type { ReactNode } from 'react';
import styles from './CardGrid.module.scss';

export interface CardGridProps {
  children: ReactNode;
}

/** Responsive grid of cover cards: about 6 per row on desktop, 2 on phones (like atsu.moe). */
export function CardGrid({ children }: CardGridProps) {
  return <div className={styles.grid}>{children}</div>;
}
