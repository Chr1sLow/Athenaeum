import { PASSWORD_MIN_LENGTH } from '@athenaeum/shared';
import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 defaults to argon2id, m=19456 KiB, t=2, p=1 (the OWASP recommendation).

export const PASSWORD_MIN = PASSWORD_MIN_LENGTH;
export const PASSWORD_MAX = 256;

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Verifying against this when the email doesn't exist makes "no such user" take as long as
// "wrong password", so response timing doesn't reveal which emails have accounts.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hash('athenaeum-timing-equalizer');
  await verifyPassword(await dummyHash, password);
}
