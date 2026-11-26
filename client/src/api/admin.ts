import type { AdminPasswordReset, AdminRow, AdminRowsResponse, AdminTable } from '@athenaeum/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.ts';

/** What the table browser asks for. Empty values are left out of the request. */
export interface AdminRowsQuery {
  page?: number;
  q?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
}

export const ADMIN_TABLES_KEY = ['admin', 'tables'] as const;

/** Every table with its columns and row count. A 404 means you aren't an admin. */
export function useAdminTables() {
  return useQuery({
    queryKey: ADMIN_TABLES_KEY,
    queryFn: () => api<AdminTable[]>('/admin/tables'),
    retry: false,
  });
}

export function useAdminRows(table: string, query: AdminRowsQuery) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v));
  const search = params.size ? `?${params}` : '';
  return useQuery({
    queryKey: ['admin', 'rows', table, search],
    queryFn: () => api<AdminRowsResponse>(`/admin/tables/${table}/rows${search}`),
    // Keep the current rows on screen while the next page or search loads.
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

/**
 * After any change made from the dashboard, refetch everything: an edit can touch what the
 * rest of the app shows (a book title, your email), and a delete cascades to other tables.
 */
function useRefetchAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useUpdateRow(table: string) {
  const refetchAll = useRefetchAll();
  return useMutation({
    mutationFn: (change: { key: AdminRow; values: AdminRow }) =>
      api<AdminRow>(`/admin/tables/${table}/rows`, { method: 'PATCH', json: change }),
    onSuccess: refetchAll,
  });
}

export function useDeleteRow(table: string) {
  const refetchAll = useRefetchAll();
  return useMutation({
    mutationFn: (key: AdminRow) => api<void>(`/admin/tables/${table}/rows`, { method: 'DELETE', json: { key } }),
    onSuccess: refetchAll,
  });
}

/** Gives the account a new random password (and signs it out everywhere). */
export function useResetPassword() {
  return useMutation({
    mutationFn: (userId: string) =>
      api<AdminPasswordReset>(`/admin/users/${userId}/reset-password`, { method: 'POST' }),
  });
}
