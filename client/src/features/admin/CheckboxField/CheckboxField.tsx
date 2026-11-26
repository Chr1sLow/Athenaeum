import styles from './CheckboxField.module.scss';

export interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
}

/** A labelled checkbox. */
export function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className={styles.field}>
      <input type="checkbox" className={styles.box} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.label}>{label}</span>
    </label>
  );
}
