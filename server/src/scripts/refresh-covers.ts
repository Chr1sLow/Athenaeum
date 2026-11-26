// Usage (from the project folder, with the database running):
//   npm run books:refresh-covers
// Recomputes every book's cover from its original file (e.g. after the cover rules change).
import { config } from '../config.ts';
import { createDb } from '../db/client.ts';
import { refreshCovers } from '../importers/refreshCovers.ts';

const { db, sql } = createDb(config.DATABASE_URL);
try {
  const { updated, failed } = await refreshCovers(db);
  console.log(`Updated the cover of ${updated} book${updated === 1 ? '' : 's'}.`);
  if (failed) {
    console.error(`${failed} book${failed === 1 ? '' : 's'} could not be re-read; their covers were left as they were.`);
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
