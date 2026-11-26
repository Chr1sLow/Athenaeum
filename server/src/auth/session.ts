import { createHash, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { sessions, users } from '../db/schema.ts';

const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * DAY;
/** Sessions are extended back to the full 30 days once they have less than this left. */
const RENEW_WHEN_UNDER_MS = 15 * DAY;

export const SESSION_COOKIE = 'athenaeum_session';

/** 256 random bits, URL-safe. Only ever stored in the user's cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What the database stores instead of the token. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionUser {
  id: string;
  email: string;
  createdAt: Date;
  /** Read from the database on every request, so revoking it takes effect at once. Never sent to the client. */
  isAdmin: boolean;
}

export interface ValidatedSession {
  user: SessionUser;
  sessionId: string;
  expiresAt: Date;
  /** True when the expiry was pushed out, so the cookie should be re-sent. */
  renewed: boolean;
}

export async function createSession(db: Db, userId: string, userAgent?: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: hashSessionToken(token),
    userId,
    expiresAt,
    userAgent: userAgent?.slice(0, 512) ?? null,
  });
  return { token, expiresAt };
}

export async function validateSessionToken(db: Db, token: string): Promise<ValidatedSession | null> {
  const sessionId = hashSessionToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      user: { id: users.id, email: users.email, createdAt: users.createdAt, isAdmin: users.isAdmin },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row) return null;

  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  if (row.expiresAt.getTime() - now < RENEW_WHEN_UNDER_MS) {
    const expiresAt = new Date(now + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId));
    return { user: row.user, sessionId, expiresAt, renewed: true };
  }

  return { user: row.user, sessionId, expiresAt: row.expiresAt, renewed: false };
}

export async function invalidateSession(db: Db, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateUserSessions(db: Db, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function deleteExpiredSessions(db: Db) {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
