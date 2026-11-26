import styles from './ResetPasswordHint.module.scss';

/** The "Forgot your password?" note under the log-in form. There is no email reset; it's a local command. */
export function ResetPasswordHint() {
  return (
    <p className={styles.hint}>
      Forgot your password? Run <code>npm run user:reset-password -- your@email</code> on the computer running
      Athenaeum.
    </p>
  );
}
