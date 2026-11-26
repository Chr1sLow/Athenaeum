import { useId } from 'react';
import styles from './ReadOnlyField.module.scss';

export interface ReadOnlyFieldProps {
  label: string;
  value: string;
}

/** A column that can't be edited here (keys, file bytes, JSON), shown as text. */
export function ReadOnlyField({ label, value }: ReadOnlyFieldProps) {
  const id = useId();
  return (
    <div className={styles.field} role="group" aria-labelledby={id}>
      <span id={id} className={styles.label}>
        {label} <span className={styles.note}>(read-only)</span>
      </span>
      <p className={styles.value}>{value}</p>
    </div>
  );
}
