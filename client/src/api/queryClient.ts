import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { HttpError } from './client.ts';
import { ME_KEY } from './auth.ts';

/**
 * One place for query defaults. Any 401 from the API means the session ended (expired or
 * signed out elsewhere), so the cached user is cleared and the route guard sends you to log in.
 */
export function createQueryClient(overrides: { retry?: boolean | number } = {}) {
  const onError = (err: unknown) => {
    if (err instanceof HttpError && err.status === 401) client.setQueryData(ME_KEY, null);
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: overrides.retry ?? 1, refetchOnWindowFocus: false },
    },
  });
  return client;
}
