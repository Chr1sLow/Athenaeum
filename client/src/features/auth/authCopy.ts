export type AuthMode = 'login' | 'signup';

/** Everything that differs between the log-in and sign-up pages. */
export const AUTH_COPY = {
  login: {
    title: 'Log in',
    subtitle: 'Welcome back to your library.',
    submit: 'Log in',
    pending: 'Logging in…',
    switchText: 'New here?',
    switchLink: 'Create an account',
    switchTo: '/signup',
    passwordAutocomplete: 'current-password',
  },
  signup: {
    title: 'Create your account',
    subtitle: 'Your books and reading progress stay on this computer.',
    submit: 'Create account',
    pending: 'Creating account…',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchTo: '/login',
    passwordAutocomplete: 'new-password',
  },
} as const;
