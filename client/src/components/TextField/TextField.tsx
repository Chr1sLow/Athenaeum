import { type ComponentPropsWithRef, type ReactNode, useId } from 'react';
import styles from './TextField.module.scss';

export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'className' | 'id'> {
  label: string;
  /** Help text under the field, read out with it. */
  hint?: string;
  /** A control inside the field's right edge, e.g. a show-password button. */
  trailing?: ReactNode;
}

/** A labelled text input with optional hint. */
export function TextField({ label, hint, trailing, 'aria-describedby': describedBy, ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describers = [describedBy, hint ? hintId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.control} ${trailing ? styles.hasTrailing : ''}`}>
        <input id={id} className={styles.input} aria-describedby={describers} {...rest} />
        {trailing && <span className={styles.trailing}>{trailing}</span>}
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
