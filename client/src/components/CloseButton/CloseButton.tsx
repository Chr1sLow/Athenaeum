import { X } from 'lucide-react';
import type { Ref } from 'react';
import styles from './CloseButton.module.scss';

export interface CloseButtonProps {
  onClick(): void;
  /** Accessible name. */
  label?: string;
  size?: 'small' | 'medium';
  ref?: Ref<HTMLButtonElement>;
}

/** The "X" in the corner of dialogs, panels and pop-ups. */
export function CloseButton({ onClick, label = 'Close', size = 'medium', ref }: CloseButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.close} ${size === 'small' ? styles.small : ''}`}
      onClick={onClick}
      aria-label={label}
    >
      <X size={size === 'small' ? 16 : 18} />
    </button>
  );
}
