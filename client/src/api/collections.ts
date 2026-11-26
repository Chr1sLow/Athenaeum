import type { CollectionDetail, CollectionInput, CollectionSummary } from '@athenaeum/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.ts';

export const COLLECTIONS_KEY = ['collections'] as const;
export const collectionKey = (id: string) => ['collection', id] as const;

export function useCollections(enabled = true) {
  return useQuery({ queryKey: COLLECTIONS_KEY, queryFn: () => api<CollectionSummary[]>('/collections'), enabled });
}

export function useCollection(id: string) {
  return useQuery({ queryKey: collectionKey(id), queryFn: () => api<CollectionDetail>(`/collections/${id}`) });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CollectionInput) => api<CollectionSummary>('/collections', { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  });
}

/** Saves an edited collection, sending only the parts that changed. */
export function useUpdateCollection(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (change: { name?: string; bookIds?: string[] }) => {
      if (change.name !== undefined) await api(`/collections/${id}`, { method: 'PATCH', json: { name: change.name } });
      if (change.bookIds !== undefined) await api(`/collections/${id}/books`, { method: 'PUT', json: { bookIds: change.bookIds } });
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
        qc.invalidateQueries({ queryKey: collectionKey(id) }),
      ]),
  });
}

export function useDeleteCollection(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/collections/${id}`, { method: 'DELETE' }),
    // The page navigates away after this. Removing its cached detail here would make the
    // still-mounted page refetch the deleted collection (a 404) on its way out.
    onSuccess: () => qc.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  });
}
