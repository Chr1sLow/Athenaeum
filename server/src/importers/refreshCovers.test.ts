import type { BookSummary } from '@athenaeum/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { books } from '../db/schema.ts';
import { makePdf } from '../test/fixtures/pdf.ts';
import { signUp, testApp, uploadAs } from '../test/helpers.ts';
import { parsePdf } from './pdf.ts';
import { refreshCovers } from './refreshCovers.ts';

describe('refreshCovers', async () => {
  const { app, db } = await testApp();
  const token = await signUp(app);
  const pdf = await makePdf({
    pages: [[{ text: 'Lantern Road', size: 20 }], ['The lanterns were lit one by one along the road at dusk.']],
    images: [{ page: 0, width: 300, height: 450, rgb: [200, 40, 40] }],
  });

  it("recomputes a book's cover from its stored original file", async () => {
    const book = (await uploadAs(app, token, 'lantern.pdf', pdf, 'application/pdf')).json<BookSummary>();
    // A cover saved by an older version of the importer.
    await db.update(books).set({ cover: Buffer.from('old cover'), coverMime: 'image/png' }).where(eq(books.id, book.id));

    expect(await refreshCovers(db, [book.id])).toEqual({ updated: 1, failed: 0 });

    const [row] = await db.select({ cover: books.cover, mime: books.coverMime }).from(books).where(eq(books.id, book.id));
    const expected = (await parsePdf(pdf, 'lantern.pdf')).cover!;
    expect(row).toEqual({ cover: expected.data, mime: 'image/jpeg' });
  });
});
