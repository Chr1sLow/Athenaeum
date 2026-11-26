import { buildApp } from './app.ts';
import { deleteExpiredSessions } from './auth/session.ts';
import { config } from './config.ts';
import { createDb } from './db/client.ts';
import { runMigrations } from './db/migrate.ts';

// Apply any new migrations on every start, including dev reloads, so a schema change never
// leaves the running server talking to an out-of-date database.
await runMigrations(config.DATABASE_URL);

const { db, sql } = createDb(config.DATABASE_URL);

const app = await buildApp(
  { db, appOrigin: config.APP_ORIGIN, allowSignup: config.ALLOW_SIGNUP, maxUploadMb: config.MAX_UPLOAD_MB },
  {
    logger: {
      level: 'info',
      // Never log cookies or auth headers.
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    },
    bodyLimit: config.MAX_UPLOAD_MB * 1024 * 1024,
  },
);

const shutdown = async () => {
  await app.close();
  await sql.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: config.HOST, port: config.PORT });

// Tidy up sessions that expired while nobody used them (now, then daily).
const sweep = () => deleteExpiredSessions(db).catch((err) => app.log.warn({ err }, 'session sweep failed'));
void sweep();
setInterval(sweep, 24 * 60 * 60 * 1000).unref();
