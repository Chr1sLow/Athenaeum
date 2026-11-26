import styles from './ProgressBar.module.scss';

export interface ProgressBarProps {
  /** 0–100. */
  value: number;
  /** Name for screen readers. Without one the bar is decoration (e.g. a percentage is shown next to it). */
  label?: string;
  /** `track`: rounded bar on a surface. `overlay`: thin strip along the bottom of a cover. */
  variant?: 'track' | 'overlay';
}

/** A horizontal progress bar. */
export function ProgressBar({ value, label, variant = 'track' }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, value));
  const a11y = label
    ? { role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(percent) }
    : { 'aria-hidden': true };

  return (
    <span className={`${styles.bar} ${styles[variant]}`} {...a11y}>
      <span className={styles.fill} style={{ width: `${percent}%` }} />
    </span>
  );
}
