// Usage (from the project folder, with the database running):
//   npm run user:reset-password -- you@example.com
import { resetPassword } from '../auth/reset.ts';
import { config } from '../config.ts';
import { createDb } from '../db/client.ts';

const email = process.argv[2];
if (!email) {
  console.error('Usage: npm run user:reset-password -- you@example.com');
  process.exit(1);
}

const { db, sql } = createDb(config.DATABASE_URL);
try {
  const password = await resetPassword(db, email);
  if (!password) {
    console.error(`No account found for ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(`Password for ${email} has been reset and all of its sessions were signed out.`);
    console.log(`Temporary password: ${password}`);
  }
} finally {
  await sql.end();
}
