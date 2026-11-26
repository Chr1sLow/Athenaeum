import { Search } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';
import styles from './SearchField.module.scss';

export interface SearchFieldProps
  extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size' | 'className' | 'onChange' | 'aria-label'> {
  /** Accessible name of the search box. */
  label: string;
  onChange?(value: string): void;
  /** `large` is the header's search box. */
  size?: 'compact' | 'large';
  /** A keyboard shortcut shown at the right edge, e.g. "Ctrl K". */
  shortcutHint?: string;
}

/** A search box with a magnifier icon. It fills its container's width. */
export function SearchField({ label, onChange, size = 'compact', shortcutHint, ...rest }: SearchFieldProps) {
  return (
    <label className={`${styles.field} ${size === 'large' ? styles.large : ''}`}>
      <Search size={size === 'large' ? 20 : 18} aria-hidden />
      <input
        type="search"
        aria-label={label}
        autoComplete="off"
        onChange={onChange && ((e) => onChange(e.target.value))}
        {...rest}
      />
      {shortcutHint && (
        <kbd className={styles.kbd} aria-hidden>
          {shortcutHint}
        </kbd>
      )}
    </label>
  );
}
