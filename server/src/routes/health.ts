import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@athenaeum/shared';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    let dbUp = false;
    try {
      await app.db.execute(sql`select 1`);
      dbUp = true;
    } catch (err) {
      app.log.warn({ err }, 'health check: database unreachable');
    }
    const body: HealthResponse = {
      status: dbUp ? 'ok' : 'degraded',
      db: dbUp ? 'up' : 'down',
      time: new Date().toISOString(),
    };
    return reply.code(dbUp ? 200 : 503).send(body);
  });
};
