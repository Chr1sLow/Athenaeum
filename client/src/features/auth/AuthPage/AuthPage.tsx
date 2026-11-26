import { AuthForm } from '../AuthForm/AuthForm.tsx';
import { AuthModeSwitch } from '../AuthModeSwitch/AuthModeSwitch.tsx';
import { type AuthMode, AUTH_COPY } from '../authCopy.ts';
import { ResetPasswordHint } from '../ResetPasswordHint/ResetPasswordHint.tsx';
import styles from './AuthPage.module.scss';

export interface AuthPageProps {
  mode: AuthMode;
}

/** /login and /signup */
export function AuthPage({ mode }: AuthPageProps) {
  const copy = AUTH_COPY[mode];

  return (
    <section className={styles.card}>
      <h1 className={styles.title}>{copy.title}</h1>
      <p className={styles.subtitle}>{copy.subtitle}</p>
      <AuthForm mode={mode} />
      <AuthModeSwitch mode={mode} />
      {mode === 'login' && <ResetPasswordHint />}
    </section>
  );
}
