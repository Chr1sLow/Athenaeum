import { describe, expect, it } from 'vitest';
import type { HealthResponse } from '@athenaeum/shared';
import { testApp } from '../test/helpers.ts';

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const { app } = await testApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json<HealthResponse>()).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('reports degraded with 503 when the database is unreachable', async () => {
    // Port 1 on localhost: nothing listens there, so the connection is refused immediately.
    const { app } = await testApp({ url: 'postgres://nobody:nothing@127.0.0.1:1/none' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json<HealthResponse>()).toMatchObject({ status: 'degraded', db: 'down' });
  });
});
