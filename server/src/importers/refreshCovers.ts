import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { bookFiles, books } from '../db/schema.ts';
import { importBook } from './index.ts';

/**
 * Re-imports each book's stored original file and saves only the cover it would get today, so
 * books added before a cover rule changed get the new cover without losing progress.
 * Every book on every account, or just `bookIds`. One file is loaded at a time.
 */
export async function refreshCovers(db: Db, bookIds?: string[]): Promise<{ updated: number; failed: number }> {
  const ids = await db
    .select({ id: bookFiles.bookId })
    .from(bookFiles)
    .where(bookIds ? inArray(bookFiles.bookId, bookIds) : undefined);

  let updated = 0;
  let failed = 0;
  for (const { id } of ids) {
    const [file] = await db.select({ data: bookFiles.data, filename: bookFiles.filename }).from(bookFiles).where(eq(bookFiles.bookId, id));
    if (!file) continue; // deleted meanwhile
    try {
      const { book } = await importBook(file.data, file.filename);
      await db
        .update(books)
        .set({ cover: book.cover?.data ?? null, coverMime: book.cover?.mime ?? null })
        .where(eq(books.id, id));
      updated++;
    } catch {
      failed++;
    }
  }
  return { updated, failed };
}
