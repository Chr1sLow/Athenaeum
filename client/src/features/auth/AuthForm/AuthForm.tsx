import { PASSWORD_MIN_LENGTH } from '@athenaeum/shared';
import { type FormEvent, useId, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { safeNextPath, useLogin, useSignup } from '../../../api/auth.ts';
import { Button } from '../../../components/Button/Button.tsx';
import { FormError } from '../../../components/FormError/FormError.tsx';
import { TextField } from '../../../components/TextField/TextField.tsx';
import { type AuthMode, AUTH_COPY } from '../authCopy.ts';
import { PasswordField } from '../PasswordField/PasswordField.tsx';
import styles from './AuthForm.module.scss';

export interface AuthFormProps {
  mode: AuthMode;
}

/** Email + password form. Checks the fields, then logs in or signs up and goes to ?next (or the shelf). */
export function AuthForm({ mode }: AuthFormProps) {
  const copy = AUTH_COPY[mode];
  const errorId = useId();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const login = useLogin();
  const signup = useSignup();
  const mutation = mode === 'login' ? login : signup;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? mutation.error?.message ?? null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    mutation.reset();
    if (!email.includes('@')) return setLocalError('Enter a valid email address');
    if (mode === 'signup' && password.length < PASSWORD_MIN_LENGTH) {
      return setLocalError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    if (!password) return setLocalError('Enter your password');
    mutation.mutate(
      { email, password },
      { onSuccess: () => navigate(safeNextPath(params.get('next')), { replace: true }) },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form} aria-describedby={error ? errorId : undefined}>
      <FormError id={errorId} message={error} />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PasswordField
        value={password}
        onChange={setPassword}
        autoComplete={copy.passwordAutocomplete}
        hint={mode === 'signup' ? `At least ${PASSWORD_MIN_LENGTH} characters.` : undefined}
      />
      <Button type="submit" variant="primary" size="large" fullWidth disabled={mutation.isPending}>
        {mutation.isPending ? copy.pending : copy.submit}
      </Button>
    </form>
  );
}
