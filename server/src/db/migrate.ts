import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './client.ts';

export const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));

export async function runMigrations(url: string) {
  const { db, sql } = createDb(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await sql.end();
  }
}

// `npm run db:migrate` runs this file directly.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { config } = await import('../config.ts');
  await runMigrations(config.DATABASE_URL);
  console.log('Migrations applied.');
}
