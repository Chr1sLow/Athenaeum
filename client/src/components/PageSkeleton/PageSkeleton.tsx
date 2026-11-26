import styles from './PageSkeleton.module.scss';

export interface PageSkeletonProps {
  /** What is loading, for screen readers: "Loading book". */
  label: string;
  /** Height of the placeholder block (any CSS length). */
  height?: string;
}

/**
 * A soft placeholder block shown while a page loads. Set `--skeleton-from` on an ancestor to
 * match a themed background (the reader does).
 */
export function PageSkeleton({ label, height = '60vh' }: PageSkeletonProps) {
  return <div role="status" aria-busy="true" aria-label={label} className={styles.skeleton} style={{ height }} />;
}
