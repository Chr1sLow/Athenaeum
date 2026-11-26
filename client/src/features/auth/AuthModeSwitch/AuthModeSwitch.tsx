import { Link, useSearchParams } from 'react-router';
import { type AuthMode, AUTH_COPY } from '../authCopy.ts';
import styles from './AuthModeSwitch.module.scss';

export interface AuthModeSwitchProps {
  mode: AuthMode;
}

/** "New here? Create an account" / "Already have an account? Log in", keeping ?next. */
export function AuthModeSwitch({ mode }: AuthModeSwitchProps) {
  const copy = AUTH_COPY[mode];
  const [params] = useSearchParams();
  const next = params.get('next');
  const href = next ? `${copy.switchTo}?next=${encodeURIComponent(next)}` : copy.switchTo;

  return (
    <p className={styles.switch}>
      {copy.switchText} <Link to={href}>{copy.switchLink}</Link>
    </p>
  );
}
