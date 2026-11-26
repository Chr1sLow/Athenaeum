import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { chapterKey, fetchChapter } from '../../api/books.ts';

/** Fetches the next chapter ahead of time so "Next chapter" opens instantly. */
export function usePrefetchNextChapter(bookId: string, index: number, chapterCount: number, inRange: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (inRange && index + 1 < chapterCount) {
      void qc.prefetchQuery({
        queryKey: chapterKey(bookId, index + 1),
        queryFn: () => fetchChapter(bookId, index + 1),
        staleTime: Infinity,
      });
    }
  }, [qc, bookId, index, chapterCount, inRange]);
}
