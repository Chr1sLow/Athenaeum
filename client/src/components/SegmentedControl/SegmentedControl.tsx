import { type ReactNode, useId } from 'react';
import styles from './SegmentedControl.module.scss';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Shown instead of the label; the label becomes the button's name and tooltip. */
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  /** Name of the group, e.g. "Sort by". */
  label: string;
  /** Show the label in front of the buttons (otherwise only screen readers hear it). */
  showLabel?: boolean;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange(value: T): void;
}

/** A row of toggle buttons where exactly one is pressed, e.g. All / Read / Unread. */
export function SegmentedControl<T extends string>({ label, showLabel, options, value, onChange }: SegmentedControlProps<T>) {
  const labelId = useId();

  return (
    <div className={styles.root}>
      {showLabel && (
        <span id={labelId} className={styles.label}>
          {label}
        </span>
      )}
      <div
        role="group"
        aria-label={showLabel ? undefined : label}
        aria-labelledby={showLabel ? labelId : undefined}
        className={styles.options}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={styles.option}
            aria-pressed={option.value === value}
            aria-label={option.icon ? option.label : undefined}
            title={option.icon ? option.label : undefined}
            onClick={() => option.value !== value && onChange(option.value)}
          >
            {option.icon ?? option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
