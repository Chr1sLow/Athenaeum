import styles from './Spinner.module.scss';

export interface SpinnerProps {
  label?: string;
}

/** A centered spinning ring, for waits with no layout to sketch yet (e.g. checking the session). */
export function Spinner({ label = 'Loading' }: SpinnerProps) {
  return (
    <div className={styles.center} aria-busy="true">
      <span role="status" aria-label={label} className={styles.ring} />
    </div>
  );
}
