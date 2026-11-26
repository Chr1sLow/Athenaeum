import type { HealthResponse } from '@athenaeum/shared';
import { useQuery } from '@tanstack/react-query';
import { HttpError, api } from './client.ts';

export type ConnectionState = 'checking' | 'ok' | 'db-down' | 'server-down';

/** Polls /api/health so the UI can tell you when Docker or the server isn't running. */
export function useConnectionState(): ConnectionState {
  const q = useQuery({
    queryKey: ['health'],
    queryFn: () => api<HealthResponse>('/health'),
    refetchInterval: (query) => (query.state.status === 'error' ? 5_000 : 60_000),
    retry: false,
  });
  if (q.isPending) return 'checking';
  if (q.isSuccess) return 'ok';
  // The server answers 503 when it's up but Postgres isn't.
  return q.error instanceof HttpError && q.error.status === 503 ? 'db-down' : 'server-down';
}
