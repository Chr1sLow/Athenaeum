import type { AuthResponse, MeResponse, User } from '@athenaeum/shared';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { PASSWORD_MAX, PASSWORD_MIN, burnPasswordCheck, hashPassword, verifyPassword } from '../auth/password.ts';
import { createSession, invalidateSession } from '../auth/session.ts';
import { users } from '../db/schema.ts';

export interface AuthRoutesOptions {
  allowSignup: boolean;
  rateLimit: { max: number; timeWindow: string | number };
}

const credentials = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Enter a valid email address' }).max(254)),
  password: z.string(),
});

const signupBody = credentials.extend({
  password: z
    .string()
    .min(PASSWORD_MIN, { error: `Password must be at least ${PASSWORD_MIN} characters` })
    .max(PASSWORD_MAX, { error: `Password must be at most ${PASSWORD_MAX} characters` }),
});

const INVALID_LOGIN = 'Invalid email or password';

export function toUser(row: { id: string; email: string; createdAt: Date }): User {
  return { id: row.id, email: row.email, createdAt: row.createdAt.toISOString() };
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === '23505' || e.cause?.code === '23505';
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, opts) => {
  const limited = { config: { rateLimit: opts.rateLimit } };

  app.post('/auth/signup', limited, async (req, reply) => {
    if (!opts.allowSignup) {
      return reply.code(403).send({ error: 'Sign-ups are closed on this Athenaeum' });
    }
    const parsed = signupBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    }
    const { email, password } = parsed.data;

    let user;
    try {
      [user] = await app.db
        .insert(users)
        .values({ email, passwordHash: await hashPassword(password) })
        .returning({ id: users.id, email: users.email, createdAt: users.createdAt });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return reply.code(409).send({ error: 'An account with that email already exists' });
      }
      throw err;
    }

    const session = await createSession(app.db, user!.id, req.headers['user-agent']);
    const body: AuthResponse = { user: toUser(user!) };
    return reply.setSessionCookie(session.token, session.expiresAt).code(201).send(body);
  });

  app.post('/auth/login', limited, async (req, reply) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return reply.code(401).send({ error: INVALID_LOGIN });
    const { email, password } = parsed.data;

    const [user] = await app.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      await burnPasswordCheck(password);
      return reply.code(401).send({ error: INVALID_LOGIN });
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      return reply.code(401).send({ error: INVALID_LOGIN });
    }

    const session = await createSession(app.db, user.id, req.headers['user-agent']);
    const body: AuthResponse = { user: toUser(user) };
    return reply.setSessionCookie(session.token, session.expiresAt).send(body);
  });

  app.post('/auth/logout', async (req, reply) => {
    if (req.sessionId) await invalidateSession(app.db, req.sessionId);
    return reply.clearSessionCookie().code(204).send();
  });

  app.get('/auth/me', async (req) => {
    const body: MeResponse = { user: req.user ? toUser(req.user) : null };
    return body;
  });
};
