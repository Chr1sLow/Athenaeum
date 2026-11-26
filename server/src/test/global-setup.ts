import { config } from '../config.ts';
import { runMigrations } from '../db/migrate.ts';
import { createDb } from '../db/client.ts';

/** Resets the test database and applies all migrations once before the test run. */
export default async function setup() {
  const url = config.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set in .env');
  if (url === config.DATABASE_URL) throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');

  const { sql } = createDb(url);
  try {
    await sql`select 1`.catch((err: { code?: string }) => {
      if (err.code === 'ECONNREFUSED') {
        throw new Error(
          'Postgres is not running. Start it with `npm run db:up` (or `docker compose up -d`), then rerun the tests.',
        );
      }
      throw err;
    });
    await sql.unsafe('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  } finally {
    await sql.end();
  }
  await runMigrations(url);
}
