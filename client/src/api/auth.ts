import type { AuthResponse, Credentials, MeResponse, User } from '@athenaeum/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.ts';

export const ME_KEY = ['me'] as const;

/**
 * Forget everything cached for the previous account. The `me` query is kept (and then
 * overwritten) rather than removed: components like the header already subscribe to it,
 * and removing it would leave them watching a dead cache entry.
 */
function clearAccountData(qc: ReturnType<typeof useQueryClient>) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'health' && q.queryKey[0] !== ME_KEY[0] });
}

/** The signed-in user, `null` when signed out. */
export function useMe() {
  return useQuery<User | null>({
    queryKey: ME_KEY,
    queryFn: async () => (await api<MeResponse>('/auth/me')).user,
    staleTime: Infinity,
    retry: false,
  });
}

function useAuthMutation(path: '/auth/login' | '/auth/signup') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Credentials) => api<AuthResponse>(path, { method: 'POST', json: body }),
    onSuccess: ({ user }) => {
      clearAccountData(qc);
      qc.setQueryData(ME_KEY, user);
    },
  });
}

export const useLogin = () => useAuthMutation('/auth/login');
export const useSignup = () => useAuthMutation('/auth/signup');

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      clearAccountData(qc);
      qc.setQueryData(ME_KEY, null);
    },
  });
}

/**
 * Where to go after signing in. Only same-site paths are allowed, so a crafted link like
 * /login?next=//evil.example can't bounce you to another website.
 */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}
