import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll } from 'vitest';
import { type AppDeps, buildApp } from '../app.ts';
import { config } from '../config.ts';
import { SESSION_COOKIE } from '../auth/session.ts';
import { createDb } from '../db/client.ts';

export const TEST_ORIGIN = 'http://localhost:5173';

/** A Fastify app wired to the test database. Closed automatically after the file's tests. */
export async function testApp(
  overrides: Partial<Omit<AppDeps, 'db'>> & { url?: string } = {},
) {
  const { url = config.TEST_DATABASE_URL!, ...deps } = overrides;
  const { db, sql } = createDb(url);
  const app = await buildApp(
    {
      db,
      appOrigin: TEST_ORIGIN,
      allowSignup: true,
      authRateLimit: { max: 1000, timeWindow: '1 minute' },
      ...deps,
    },
    { logger: false },
  );
  afterAll(async () => {
    await app.close();
    await sql.end({ timeout: 1 });
  });
  return { app, db, sql };
}

/** A unique email per call, so tests never collide in the shared test database. */
export function uniqueEmail(label = 'user') {
  return `${label}-${randomUUID().slice(0, 8)}@test.local`;
}

/** Headers a browser on the app's own origin would send. */
export const sameOrigin = { origin: TEST_ORIGIN };

/** The session token from a response's Set-Cookie header. */
export function sessionToken(res: LightMyRequestResponse): string | undefined {
  return res.cookies.find((c) => c.name === SESSION_COOKIE)?.value || undefined;
}

export function withSession(token: string) {
  return { ...sameOrigin, cookie: `${SESSION_COOKIE}=${token}` };
}

type App = Awaited<ReturnType<typeof testApp>>['app'];

/** Creates a fresh account and returns its session token. */
export async function signUp(app: App, label = 'reader'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: sameOrigin,
    payload: { email: uniqueEmail(label), password: 'correct horse battery' },
  });
  return sessionToken(res)!;
}

/** A multipart/form-data body with one file field, as a browser upload sends it. */
export function multipartFile(filename: string, data: Buffer, contentType = 'application/octet-stream', field = 'file') {
  const boundary = `----athenaeum${randomUUID()}`;
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

/** Uploads a file as the given user. */
export function uploadAs(app: App, token: string, filename: string, data: Buffer, contentType?: string) {
  const body = multipartFile(filename, data, contentType);
  return app.inject({
    method: 'POST',
    url: '/api/books',
    headers: { ...withSession(token), ...body.headers },
    payload: body.payload,
  });
}
