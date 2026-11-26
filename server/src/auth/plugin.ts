import cookie from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { SESSION_COOKIE, type SessionUser, validateSessionToken } from './session.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
    sessionId: string | null;
  }
  interface FastifyReply {
    setSessionCookie(token: string, expiresAt: Date): FastifyReply;
    clearSessionCookie(): FastifyReply;
  }
}

export interface AuthPluginOptions {
  /** The browser origin the app is served from, e.g. http://localhost:5173. */
  appOrigin: string;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Origins allowed to make state-changing requests. `localhost` and `127.0.0.1` are the
 * same machine, so either spelling of APP_ORIGIN is accepted.
 */
export function allowedOrigins(appOrigin: string): Set<string> {
  const url = new URL(appOrigin);
  const out = new Set([url.origin]);
  const twin = { localhost: '127.0.0.1', '127.0.0.1': 'localhost' }[url.hostname];
  if (twin) {
    url.hostname = twin;
    out.add(url.origin);
  }
  return out;
}

/**
 * Reads the session cookie on every request and sets `req.user`. Rejects state-changing
 * requests from any other origin (blocks cross-site request forgery).
 */
export const authPlugin = fp<AuthPluginOptions>(
  async (app, opts) => {
    const origins = allowedOrigins(opts.appOrigin);
    const secure = opts.appOrigin.startsWith('https://');

    await app.register(cookie);

    app.decorateRequest('user', null);
    app.decorateRequest('sessionId', null);

    app.decorateReply('setSessionCookie', function (this: FastifyReply, token: string, expiresAt: Date) {
      return this.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        expires: expiresAt,
      });
    });

    app.decorateReply('clearSessionCookie', function (this: FastifyReply) {
      return this.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
    });

    app.addHook('onRequest', async (req, reply) => {
      if (!SAFE_METHODS.has(req.method)) {
        const origin = req.headers.origin;
        if (!origin || !origins.has(origin)) {
          return reply.code(403).send({ error: 'Request blocked: unexpected origin' });
        }
      }

      const token = req.cookies[SESSION_COOKIE];
      if (!token) return;
      const session = await validateSessionToken(app.db, token);
      if (!session) {
        reply.clearSessionCookie();
        return;
      }
      req.user = session.user;
      req.sessionId = session.sessionId;
      if (session.renewed) reply.setSessionCookie(token, session.expiresAt);
    });
  },
  { name: 'auth' },
);

/** preHandler for routes that need a signed-in user. */
export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) return reply.code(401).send({ error: 'Not signed in' });
}

/**
 * preHandler for /api/admin routes. Anyone who isn't an admin, signed in or not, gets the same
 * 404 as a route that doesn't exist, so the admin area doesn't reveal itself.
 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user?.isAdmin) {
    reply.callNotFound();
    return reply;
  }
}
