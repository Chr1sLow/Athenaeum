import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { users } from '../db/schema.ts';
import { hashPassword } from './password.ts';
import { invalidateUserSessions } from './session.ts';

/**
 * Gives the account a new random password and signs it out everywhere.
 * Returns the new password, or null if no account has that email.
 * A future emailed-reset flow can call this same function.
 */
export async function resetPassword(db: Db, email: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user) return null;

  const temporary = randomBytes(12).toString('base64url'); // 16 characters
  await db.update(users).set({ passwordHash: await hashPassword(temporary) }).where(eq(users.id, user.id));
  await invalidateUserSessions(db, user.id);
  return temporary;
}
