import type { Block, BookDetail, BookSummary, Chapter, Progress } from '@athenaeum/shared';
import multipart from '@fastify/multipart';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/plugin.ts';
import type { Db } from '../db/client.ts';
import { bookFiles, bookImages, books, chapterReads, chapters, progress } from '../db/schema.ts';
import { ImportError, MIME_TYPES, importBook } from '../importers/index.ts';
import type { ImportedBook } from '../importers/types.ts';

export interface BooksRoutesOptions {
  maxUploadBytes: number;
}

const uuid = z.uuid();
const chapterIndex = z.coerce.number().int().min(0);

/** Columns for a shelf entry. Never selects binary columns. */
export const summaryColumns = {
  id: books.id,
  title: books.title,
  author: books.author,
  format: books.format,
  hasCover: sql<boolean>`${books.cover} is not null`,
  chapterCount: books.chapterCount,
  wordCount: books.wordCount,
  percent: sql<number>`coalesce(${progress.percent}, 0)`,
  chapterIndex: sql<number>`coalesce(${progress.chapterIndex}, 0)`,
  addedAt: books.addedAt,
  lastReadAt: books.lastReadAt,
  pinned: books.pinned,
};

export type SummaryRow = {
  [K in keyof typeof summaryColumns]: K extends 'addedAt' ? Date : K extends 'lastReadAt' ? Date | null : unknown;
} & Omit<BookSummary, 'addedAt' | 'lastReadAt'>;

export function toSummary(row: SummaryRow): BookSummary {
  return {
    ...row,
    percent: Number(row.percent),
    chapterIndex: Number(row.chapterIndex),
    addedAt: row.addedAt.toISOString(),
    lastReadAt: row.lastReadAt ? row.lastReadAt.toISOString() : null,
  };
}

function toProgress(row: typeof progress.$inferSelect): Progress {
  return {
    chapterIndex: row.chapterIndex,
    blockIndex: row.blockIndex,
    percent: row.percent,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: 'Book not found' });

/** The book's summary if it exists and belongs to the user; null otherwise (including bad ids). */
async function findOwned(db: Db, userId: string, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [row] = await db
    .select(summaryColumns)
    .from(books)
    .leftJoin(progress, eq(progress.bookId, books.id))
    .where(and(eq(books.id, id), eq(books.userId, userId)))
    .limit(1);
  return row ? toSummary(row as SummaryRow) : null;
}

async function saveImported(
  db: Db,
  userId: string,
  file: { filename: string; mime: string; data: Buffer },
  format: keyof typeof MIME_TYPES,
  imported: ImportedBook,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [book] = await tx
      .insert(books)
      .values({
        userId,
        title: imported.title,
        author: imported.author,
        description: imported.description,
        format,
        cover: imported.cover?.data ?? null,
        coverMime: imported.cover?.mime ?? null,
        chapterCount: imported.chapters.length,
        wordCount: imported.chapters.reduce((n, c) => n + c.wordCount, 0),
      })
      .returning({ id: books.id });
    const bookId = book!.id;

    await tx.insert(bookFiles).values({ bookId, filename: file.filename, mime: file.mime, sizeBytes: file.data.length, data: file.data });

    const imageIds = new Map<string, string>();
    for (const img of imported.images) {
      const [row] = await tx.insert(bookImages).values({ bookId, mime: img.mime, data: img.data }).returning({ id: bookImages.id });
      imageIds.set(img.key, row!.id);
    }

    const rows = imported.chapters.map((c, index) => ({
      bookId,
      index,
      title: c.title,
      wordCount: c.wordCount,
      blocks: c.blocks.map((b): Block => (b.type === 'img' ? { ...b, imageId: imageIds.get(b.imageId)! } : b)),
      gallery: c.gallery.map(({ key, width, height }) => ({ imageId: imageIds.get(key)!, width, height })),
    }));
    for (let i = 0; i < rows.length; i += 500) await tx.insert(chapters).values(rows.slice(i, i + 500));
    return bookId;
  });
}

/** `filename="..."` with an RFC 5987 fallback for non-ASCII names. */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const header = `attachment; filename="${ascii}"`;
  return ascii === filename ? header : `${header}; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export const booksRoutes: FastifyPluginAsync<BooksRoutesOptions> = async (app, opts) => {
  await app.register(multipart, { limits: { fileSize: opts.maxUploadBytes, files: 1, fields: 0 } });
  app.addHook('preHandler', requireUser);

  app.get('/books', async (req) => {
    const rows = await app.db
      .select(summaryColumns)
      .from(books)
      .leftJoin(progress, eq(progress.bookId, books.id))
      .where(eq(books.userId, req.user!.id))
      .orderBy(desc(sql`coalesce(${books.lastReadAt}, ${books.addedAt})`), desc(books.addedAt));
    return rows.map((r) => toSummary(r as SummaryRow));
  });

  app.post('/books', async (req, reply) => {
    if (!req.isMultipart()) return reply.code(400).send({ error: 'Send the book as a file upload.' });
    let upload;
    try {
      upload = await req.file();
    } catch {
      return reply.code(400).send({ error: 'Send the book as a file upload.' });
    }
    if (!upload) return reply.code(400).send({ error: 'No file was uploaded.' });

    let data: Buffer;
    try {
      data = await upload.toBuffer();
    } catch (err) {
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        const mb = Math.round((opts.maxUploadBytes / 1024 / 1024) * 10) / 10;
        return reply.code(413).send({ error: `This file is larger than the ${mb} MB upload limit.` });
      }
      throw err;
    }

    let result;
    try {
      result = await importBook(data, upload.filename);
    } catch (err) {
      if (err instanceof ImportError) return reply.code(err.status).send({ error: err.message });
      req.log.error({ err }, 'import failed');
      return reply.code(422).send({ error: "Something went wrong reading this file. It may be damaged." });
    }

    const id = await saveImported(
      app.db,
      req.user!.id,
      { filename: upload.filename || `book.${result.format}`, mime: MIME_TYPES[result.format], data },
      result.format,
      result.book,
    );
    const summary = await findOwned(app.db, req.user!.id, id);
    return reply.code(201).send(summary);
  });

  app.get<{ Params: { id: string } }>('/books/:id', async (req, reply) => {
    const summary = await findOwned(app.db, req.user!.id, req.params.id);
    if (!summary) return notFound(reply);
    const [extra] = await app.db
      .select({ description: books.description, filename: bookFiles.filename, sizeBytes: bookFiles.sizeBytes })
      .from(books)
      .innerJoin(bookFiles, eq(bookFiles.bookId, books.id))
      .where(eq(books.id, summary.id));
    const chapterRows = await app.db
      .select({ index: chapters.index, title: chapters.title, wordCount: chapters.wordCount })
      .from(chapters)
      .where(eq(chapters.bookId, summary.id))
      .orderBy(asc(chapters.index));
    const reads = new Set(
      (await app.db.select({ i: chapterReads.chapterIndex }).from(chapterReads).where(eq(chapterReads.bookId, summary.id))).map((r) => r.i),
    );
    const [prog] = await app.db.select().from(progress).where(eq(progress.bookId, summary.id));
    const body: BookDetail = {
      ...summary,
      description: extra?.description ?? null,
      filename: extra?.filename ?? '',
      sizeBytes: extra?.sizeBytes ?? 0,
      chapters: chapterRows.map((c) => ({ ...c, read: reads.has(c.index) })),
      progress: prog ? toProgress(prog) : null,
    };
    return body;
  });

  app.delete<{ Params: { id: string } }>('/books/:id', async (req, reply) => {
    const summary = await findOwned(app.db, req.user!.id, req.params.id);
    if (!summary) return notFound(reply);
    await app.db.delete(books).where(eq(books.id, summary.id));
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>('/books/:id/cover', async (req, reply) => {
    const summary = await findOwned(app.db, req.user!.id, req.params.id);
    if (!summary) return notFound(reply);
    const [row] = await app.db.select({ cover: books.cover, mime: books.coverMime }).from(books).where(eq(books.id, summary.id));
    if (!row?.cover) return reply.code(404).send({ error: 'This book has no cover image' });
    return reply
      .header('cache-control', 'private, max-age=31536000, immutable')
      .type(row.mime ?? 'application/octet-stream')
      .send(row.cover);
  });

  app.get<{ Params: { id: string } }>('/books/:id/file', async (req, reply) => {
    const summary = await findOwned(app.db, req.user!.id, req.params.id);
    if (!summary) return notFound(reply);
    const [file] = await app.db.select().from(bookFiles).where(eq(bookFiles.bookId, summary.id));
    if (!file) return notFound(reply);
    return reply.type(file.mime).header('content-disposition', contentDisposition(file.filename)).send(file.data);
  });

  app.get<{ Params: { id: string; index: string } }>('/books/:id/chapters/:index', async (req, reply) => {
    const summary = await findOwned(app.db, req.user!.id, req.params.id);
    const index = chapterIndex.safeParse(req.params.index);
    if (!summary || !index.success) return notFound(reply);
    const [row] = await app.db
      .select()
      .from(chapters)
      .where(and(eq(chapters.bookId, summary.id), eq(chapters.index, index.data)));
    if (!row) return reply.code(404).send({ error: 'Chapter not found' });
    const body: Chapter = {
      bookId: row.bookId,
      index: row.index,
      title: row.title,
      wordCount: row.wordCount,
      blocks: row.blocks,
      gallery: row.gallery,
    };
    return body;
  });

  app.get<{ Params: { id: string; imageId: string } }>('/books/:id/images/:imageId', async (req, reply) => {
    const summary = await findOwned(app.db, req.user!.id, req.params.id);
    if (!summary || !uuid.safeParse(req.params.imageId).success) return notFound(reply);
    const [img] = await app.db
      .select()
      .from(bookImages)
      .where(and(eq(bookImages.id, req.params.imageId), eq(bookImages.bookId, summary.id)));
    if (!img) return reply.code(404).send({ error: 'Image not found' });
    return reply.header('cache-control', 'private, max-age=31536000, immutable').type(img.mime).send(img.data);
  });

  app.get<{ Params: { id: string } }>('/books/:id/progress', async (req, reply) => {
    const summary = await findOwned(app.db, req.user!.id, req.params.id);
    if (!summary) return notFound(reply);
    const [row] = await app.db.select().from(progress).where(eq(progress.bookId, summary.id));
    return reply.send(row ? toProgress(row) : null);
  });

  app.put<{ Params: { id: string } }>('/books/:id/progress', async (req, reply) => {
    const summary = await findOwned(app.db, req.user!.id, req.params.id);
    if (!summary) return notFound(reply);
    const parsed = z
      .object({
        chapterIndex: z.number().int().min(0).max(summary.chapterCount - 1),
        blockIndex: z.number().int().min(0),
        percent: z.number().min(0).max(100),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid progress' });

    const now = new Date();
    const [row] = await app.db
      .insert(progress)
      .values({ bookId: summary.id, ...parsed.data, updatedAt: now })
      .onConflictDoUpdate({ target: progress.bookId, set: { ...parsed.data, updatedAt: now } })
      .returning();
    await app.db.update(books).set({ lastReadAt: now }).where(eq(books.id, summary.id));
    return toProgress(row!);
  });

  app.put<{ Params: { id: string; index: string } }>('/books/:id/chapters/:index/read', async (req, reply) => {
    const summary = await findOwned(app.db, req.user!.id, req.params.id);
    const index = chapterIndex.safeParse(req.params.index);
    if (!summary || !index.success) return notFound(reply);
    const body = z.object({ read: z.boolean() }).safeParse(req.body);
    if (!body.success || index.data >= summary.chapterCount) return reply.code(400).send({ error: 'Invalid request' });

    if (body.data.read) {
      await app.db.insert(chapterReads).values({ bookId: summary.id, chapterIndex: index.data }).onConflictDoNothing();
    } else {
      await app.db
        .delete(chapterReads)
        .where(and(eq(chapterReads.bookId, summary.id), eq(chapterReads.chapterIndex, index.data)));
    }
    return reply.code(204).send();
  });

  app.put<{ Params: { id: string } }>('/books/:id/pin', async (req, reply) => {
    const summary = await findOwned(app.db, req.user!.id, req.params.id);
    if (!summary) return notFound(reply);
      const body = z.object({ pinned: z.boolean() }).safeParse(req.body);  
    if (!body.success) return reply.code(400).send({ error: 'Invalid request' });
    
    await app.db.update(books).set({ pinned: body.data.pinned }).where(eq(books.id, summary.id)  );
    return reply.code(204).send  ();
  });
};
