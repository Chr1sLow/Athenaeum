import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { TextField } from '../../../components/TextField/TextField.tsx';
import styles from './PasswordField.module.scss';

export interface PasswordFieldProps {
  value: string;
  onChange(value: string): void;
  autoComplete: 'current-password' | 'new-password';
  hint?: string;
}

/** A password input with an eye button that shows or hides what you typed. */
export function PasswordField({ value, onChange, autoComplete, hint }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  const toggle = (
    <button
      type="button"
      className={styles.reveal}
      onClick={() => setVisible((v) => !v)}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
    >
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );

  return (
    <TextField
      label="Password"
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      hint={hint}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      trailing={toggle}
    />
  );
}
