import { describe, expect, it } from 'vitest';
import { sameOrigin, sessionToken, testApp, uniqueEmail, withSession } from '../test/helpers.ts';
import { resetPassword } from './reset.ts';

describe('resetPassword', async () => {
  const { app, db } = await testApp();
  const login = (email: string, password: string) =>
    app.inject({ method: 'POST', url: '/api/auth/login', headers: sameOrigin, payload: { email, password } });

  it('sets a new temporary password and signs the account out everywhere', async () => {
    const email = uniqueEmail();
    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: sameOrigin,
      payload: { email, password: 'old password 1' },
    });
    const oldToken = sessionToken(signup)!;

    const temporary = await resetPassword(db, email.toUpperCase());
    expect(temporary).toMatch(/^[\w-]{16}$/);

    expect((await login(email, 'old password 1')).statusCode).toBe(401);
    expect((await login(email, temporary!)).statusCode).toBe(200);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: withSession(oldToken) });
    expect(me.json().user).toBeNull();
  });

  it('returns null for an unknown email', async () => {
    expect(await resetPassword(db, uniqueEmail('nobody'))).toBeNull();
  });
});
