import type { ApiError, BookDetail, BookSummary, Chapter, Progress, ProgressInput } from '@athenaeum/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpError, api } from './client.ts';
import { COLLECTIONS_KEY } from './collections.ts';

export const BOOKS_KEY = ['books'] as const;
export const bookKey = (id: string) => ['book', id] as const;
export const chapterKey = (id: string, index: number) => ['chapter', id, index] as const;

export function useBooks() {
  return useQuery({ queryKey: BOOKS_KEY, queryFn: () => api<BookSummary[]>('/books') });
}

export function useBook(id: string) {
  return useQuery({ queryKey: bookKey(id), queryFn: () => api<BookDetail>(`/books/${id}`) });
}

export const fetchChapter = (id: string, index: number) => api<Chapter>(`/books/${id}/chapters/${index}`);

export function useChapter(id: string, index: number, enabled = true) {
  return useQuery({
    queryKey: chapterKey(id, index),
    queryFn: () => fetchChapter(id, index),
    staleTime: Infinity,
    enabled,
  });
}

export function useSaveProgress(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProgressInput) => api<Progress>(`/books/${id}/progress`, { method: 'PUT', json: input }),
    onSuccess: (saved) => {
      // Keep the cached book in step, so its page shows "Continue" from here when you go back.
      qc.setQueryData<BookDetail>(bookKey(id), (old) =>
        old ? { ...old, progress: saved, chapterIndex: saved.chapterIndex, percent: saved.percent, lastReadAt: saved.updatedAt } : old,
      );
      return qc.invalidateQueries({ queryKey: BOOKS_KEY });
    },
  });
}

export function useMarkRead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ index, read }: { index: number; read: boolean }) =>
      api<void>(`/books/${id}/chapters/${index}/read`, { method: 'PUT', json: { read } }),
    onSuccess: (_data, { index, read }) => {
      qc.setQueryData<BookDetail>(bookKey(id), (old) =>
        old ? { ...old, chapters: old.chapters.map((c) => (c.index === index ? { ...c, read } : c)) } : old,
      );
    },
  });
}

/** Pints or unpins a book for a user */
export function usePinBook(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pinned }: { pinned: boolean }) => api<void>(`/books/${id}/pin`, { method: 'PUT', json: { pinned } }),
    onSuccess: (_data, { pinned }) => {
      qc.setQueryData<BookDetail>(bookKey(id), (old) => old ? { ...old, pinned } : old);
    },
  });
}

/** Deletes a book and everything stored with it (chapters, progress, its place in collections). */
export function useDeleteBook(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/books/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.setQueryData<BookSummary[]>(BOOKS_KEY, (old) => old?.filter((b) => b.id !== id));
      qc.removeQueries({ queryKey: bookKey(id) });
      qc.removeQueries({ queryKey: ['chapter', id] });
      // Collection counts and cover mosaics may have included it.
      return Promise.all([
        qc.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
        qc.invalidateQueries({ queryKey: ['collection'] }),
      ]);
    },
  });
}

/**
 * Uploads one book file. Uses XMLHttpRequest because fetch can't report upload progress.
 * `onProgress` gets 0–100 while the bytes are sent; the server then parses the file before replying.
 */
export function uploadBook(file: File, onProgress: (percent: number) => void): Promise<BookSummary> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/books');
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as BookSummary);
      else reject(new HttpError(xhr.status, (body as ApiError | undefined)?.error ?? `Upload failed (${xhr.status})`, body));
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed: the connection to Athenaeum was lost.')));
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}
