import { useId } from 'react';
import styles from './SelectField.module.scss';

export interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange(value: string): void;
}

/** A labelled drop-down list. */
export function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select id={id} className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
