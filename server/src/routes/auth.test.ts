import type { AuthResponse } from '@athenaeum/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { hashSessionToken } from '../auth/session.ts';
import { sessions, users } from '../db/schema.ts';
import { sameOrigin, sessionToken, testApp, uniqueEmail, withSession } from '../test/helpers.ts';

const PASSWORD = 'correct horse battery';

describe('auth', async () => {
  const { app, db } = await testApp();

  async function signup(email: string, password = PASSWORD) {
    return app.inject({ method: 'POST', url: '/api/auth/signup', headers: sameOrigin, payload: { email, password } });
  }
  async function login(email: string, password = PASSWORD) {
    return app.inject({ method: 'POST', url: '/api/auth/login', headers: sameOrigin, payload: { email, password } });
  }
  async function me(token?: string) {
    return app.inject({ method: 'GET', url: '/api/auth/me', headers: token ? withSession(token) : {} });
  }

  describe('signup', () => {
    it('creates the account, signs it in, and stores only a hash of the password', async () => {
      const email = uniqueEmail();
      const res = await signup(email);
      expect(res.statusCode).toBe(201);
      expect(res.json<AuthResponse>().user.email).toBe(email);

      const cookie = res.cookies.find((c) => c.name === 'athenaeum_session')!;
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
      expect(cookie.secure).toBeFalsy(); // http://localhost; turns on for https origins

      const [row] = await db.select().from(users).where(eq(users.email, email));
      expect(row!.passwordHash).toMatch(/^\$argon2id\$/);
      expect(row!.passwordHash).not.toContain(PASSWORD);

      expect((await me(cookie.value)).json<AuthResponse>().user.email).toBe(email);
    });

    it('normalizes email case and whitespace, and rejects duplicates', async () => {
      const email = uniqueEmail();
      expect((await signup(`  ${email.toUpperCase()} `)).json<AuthResponse>().user.email).toBe(email);
      const dup = await signup(email);
      expect(dup.statusCode).toBe(409);
      expect(dup.json()).toEqual({ error: 'An account with that email already exists' });
    });

    it('rejects an invalid email or a short password', async () => {
      expect((await signup('not-an-email')).statusCode).toBe(400);
      const short = await signup(uniqueEmail(), 'short');
      expect(short.statusCode).toBe(400);
      expect(short.json()).toEqual({ error: 'Password must be at least 8 characters' });
    });

    it('is refused when sign-ups are closed', async () => {
      const closed = await testApp({ allowSignup: false });
      const res = await closed.app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: sameOrigin,
        payload: { email: uniqueEmail(), password: PASSWORD },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('login', () => {
    it('signs in with the right password', async () => {
      const email = uniqueEmail();
      await signup(email);
      const res = await login(email.toUpperCase());
      expect(res.statusCode).toBe(200);
      expect((await me(sessionToken(res))).json().user.email).toBe(email);
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const email = uniqueEmail();
      await signup(email);
      const wrong = await login(email, 'wrong password!');
      const unknown = await login(uniqueEmail('nobody'));
      expect(wrong.statusCode).toBe(401);
      expect(unknown.statusCode).toBe(401);
      expect(wrong.json()).toEqual({ error: 'Invalid email or password' });
      expect(unknown.json()).toEqual(wrong.json());
      expect(sessionToken(wrong)).toBeUndefined();
    });

    it('is rate limited per IP', async () => {
      const limited = await testApp({ authRateLimit: { max: 3, timeWindow: '1 minute' } });
      const attempt = () =>
        limited.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          headers: sameOrigin,
          payload: { email: uniqueEmail(), password: 'whatever1' },
        });
      for (let i = 0; i < 3; i++) expect((await attempt()).statusCode).toBe(401);
      expect((await attempt()).statusCode).toBe(429);
    });
  });

  describe('sessions', () => {
    it('stores only the sha256 of the token', async () => {
      const token = sessionToken(await signup(uniqueEmail()))!;
      expect(await db.select().from(sessions).where(eq(sessions.id, token))).toHaveLength(0);
      expect(await db.select().from(sessions).where(eq(sessions.id, hashSessionToken(token)))).toHaveLength(1);
    });

    it('logout ends the session and clears the cookie', async () => {
      const token = sessionToken(await signup(uniqueEmail()))!;
      const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: withSession(token) });
      expect(res.statusCode).toBe(204);
      expect(res.cookies.find((c) => c.name === 'athenaeum_session')?.value).toBe('');
      expect((await me(token)).json().user).toBeNull();
    });

    it('rejects and deletes an expired session', async () => {
      const token = sessionToken(await signup(uniqueEmail()))!;
      const id = hashSessionToken(token);
      await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, id));
      expect((await me(token)).json().user).toBeNull();
      expect(await db.select().from(sessions).where(eq(sessions.id, id))).toHaveLength(0);
    });

    it('extends a session that is close to expiring', async () => {
      const token = sessionToken(await signup(uniqueEmail()))!;
      const id = hashSessionToken(token);
      await db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
        .where(eq(sessions.id, id));
      const res = await me(token);
      expect(res.json().user).not.toBeNull();
      expect(sessionToken(res)).toBe(token); // cookie re-sent with the new expiry
      const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    });

    it('ignores a made-up token', async () => {
      expect((await me('not-a-real-token')).json().user).toBeNull();
    });

    it('keeps each user to their own session', async () => {
      const a = uniqueEmail('a');
      const b = uniqueEmail('b');
      const tokenA = sessionToken(await signup(a))!;
      const tokenB = sessionToken(await signup(b))!;
      expect((await me(tokenA)).json<AuthResponse>().user.email).toBe(a);
      expect((await me(tokenB)).json<AuthResponse>().user.email).toBe(b);
    });
  });

  describe('cross-site request protection', () => {
    const payload = { email: uniqueEmail(), password: PASSWORD };

    it('blocks state-changing requests from another origin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: 'https://evil.example' },
        payload,
      });
      expect(res.statusCode).toBe(403);
    });

    it('blocks state-changing requests with no Origin header', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload });
      expect(res.statusCode).toBe(403);
    });

    it('accepts 127.0.0.1 as the same machine as localhost', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: 'http://127.0.0.1:5173' },
        payload,
      });
      expect(res.statusCode).toBe(401); // got past the origin check to the password check
    });

    it('does not block reads', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { origin: 'https://evil.example' } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ user: null });
    });
  });
});
