import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { authPlugin } from './auth/plugin.ts';
import type { Db } from './db/client.ts';
import { adminRoutes } from './routes/admin.ts';
import { type AuthRoutesOptions, authRoutes } from './routes/auth.ts';
import { booksRoutes } from './routes/books.ts';
import { collectionsRoutes } from './routes/collections.ts';
import { healthRoutes } from './routes/health.ts';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export interface AppDeps {
  db: Db;
  /** Browser origin of the app; used for the origin check and the cookie's Secure flag. */
  appOrigin: string;
  allowSignup: boolean;
  /** Attempts per IP on login/signup. */
  authRateLimit?: AuthRoutesOptions['rateLimit'];
  /** Largest accepted book upload, in MB (default 200). */
  maxUploadMb?: number;
}

/** Builds the app without listening, so tests can drive it with `app.inject()`. */
export async function buildApp(deps: AppDeps, opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);
  app.decorate('db', deps.db);

  // Only routes that opt in (login/signup) are limited.
  await app.register(rateLimit, { global: false });
  await app.register(authPlugin, { appOrigin: deps.appOrigin });

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authRoutes, {
        allowSignup: deps.allowSignup,
        rateLimit: deps.authRateLimit ?? { max: 10, timeWindow: '15 minutes' },
      });
      await api.register(booksRoutes, { maxUploadBytes: Math.floor((deps.maxUploadMb ?? 200) * 1024 * 1024) });
      await api.register(collectionsRoutes);
      await api.register(adminRoutes);
    },
    { prefix: '/api' },
  );

  return app;
}
