import type { User } from '@athenaeum/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { createQueryClient } from '../api/queryClient.ts';
import { routes } from '../router.tsx';

/** Renders the real route tree at `path` with a fresh query cache. */
export function renderApp(path = '/') {
  const queryClient = createQueryClient({ retry: false });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router };
}

export const TEST_USER: User = { id: 'u1', email: 'reader@example.com', createdAt: '2026-11-22T00:00:00.000Z' };

type Reply = { status: number; body?: unknown } | 'network-error';
type Handler = (req: { body: unknown }) => Reply;

/**
 * Fakes the API. Keys are "METHOD /path" (without /api). Unmatched requests get 404.
 * Defaults: healthy server, signed out.
 */
export function mockApi(handlers: Record<string, Handler | Reply> = {}) {
  const all: Record<string, Handler | Reply> = {
    'GET /health': { status: 200, body: { status: 'ok', db: 'up', time: '' } },
    'GET /auth/me': { status: 200, body: { user: null } },
    'GET /books': { status: 200, body: [] },
    'GET /collections': { status: 200, body: [] },
    ...handlers,
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const key = `${init?.method ?? 'GET'} ${url.pathname.replace(/^\/api/, '')}`;
    const entry = all[key];
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const reply: Reply =
      typeof entry === 'function' ? entry({ body }) : (entry ?? { status: 404, body: { error: 'Not found' } });
    if (reply === 'network-error') throw new TypeError('Failed to fetch');
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: reply.body === undefined ? {} : { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Mock API where TEST_USER is signed in. */
export function mockSignedIn(handlers: Record<string, Handler | Reply> = {}) {
  return mockApi({ 'GET /auth/me': { status: 200, body: { user: TEST_USER } }, ...handlers });
}

/** JSON bodies of the calls the fake API received for "METHOD /path". */
export function callsTo(fetchMock: ReturnType<typeof mockApi>, key: string) {
  const [method, path] = key.split(' ');
  return fetchMock.mock.calls
    .filter(([input, init]) => (init?.method ?? 'GET') === method && String(input) === `/api${path}`)
    .map(([, init]) => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined));
}
