import { COLLECTION_NAME_MAX, type CollectionBook, type CollectionDetail, type CollectionSummary } from '@athenaeum/shared';
import { and, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/plugin.ts';
import type { Db } from '../db/client.ts';
import { books, collectionBooks, collections, progress } from '../db/schema.ts';
import { type SummaryRow, summaryColumns, toSummary } from './books.ts';

const uuid = z.uuid();
const name = z.string().trim().min(1, { error: 'Give the collection a name' }).max(COLLECTION_NAME_MAX, {
  error: `Collection names can be up to ${COLLECTION_NAME_MAX} characters`,
});
const bookIds = z.array(z.uuid()).max(10_000);

const PREVIEW_COUNT = 4;

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: 'Collection not found' });
const duplicate = (reply: FastifyReply, n: string) =>
  reply.code(409).send({ error: `You already have a collection called “${n}”.` });

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === '23505' || e.cause?.code === '23505';
}

async function findOwned(db: Db, userId: string, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)));
  return row ?? null;
}

/** De-duplicated ids if every one is a book this user owns; null otherwise. */
async function ownedBookIds(db: Db, userId: string, ids: string[]): Promise<string[] | null> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const found = await db
    .select({ id: books.id })
    .from(books)
    .where(and(inArray(books.id, unique), eq(books.userId, userId)));
  return found.length === unique.length ? unique : null;
}

/** Shelf cards for the given collections (all of the user's when `ids` is omitted), sorted by name. */
async function summaries(db: Db, userId: string, ids?: string[]): Promise<CollectionSummary[]> {
  const where = ids ? and(eq(collections.userId, userId), inArray(collections.id, ids)) : eq(collections.userId, userId);
  const rows = await db.select().from(collections).where(where).orderBy(sql`lower(${collections.name})`);
  if (!rows.length) return [];
  const collectionIds = rows.map((r) => r.id);

  const counts = new Map(
    (
      await db
        .select({ id: collectionBooks.collectionId, n: count() })
        .from(collectionBooks)
        .where(inArray(collectionBooks.collectionId, collectionIds))
        .groupBy(collectionBooks.collectionId)
    ).map((r) => [r.id, Number(r.n)]),
  );

  const previews = new Map<string, CollectionSummary['previewBooks']>();
  const previewRows = await db
    .select({
      collectionId: collectionBooks.collectionId,
      id: books.id,
      title: books.title,
      hasCover: sql<boolean>`${books.cover} is not null`,
    })
    .from(collectionBooks)
    .innerJoin(books, eq(books.id, collectionBooks.bookId))
    .where(inArray(collectionBooks.collectionId, collectionIds))
    .orderBy(desc(collectionBooks.addedAt), desc(books.addedAt));
  for (const { collectionId, ...book } of previewRows) {
    const list = previews.get(collectionId) ?? [];
    if (list.length < PREVIEW_COUNT) list.push(book);
    previews.set(collectionId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    bookCount: counts.get(r.id) ?? 0,
    previewBooks: previews.get(r.id) ?? [],
    createdAt: r.createdAt.toISOString(),
  }));
}

async function replaceBooks(db: Db, collectionId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    await tx
      .delete(collectionBooks)
      .where(
        ids.length
          ? and(eq(collectionBooks.collectionId, collectionId), notInArray(collectionBooks.bookId, ids))
          : eq(collectionBooks.collectionId, collectionId),
      );
    if (ids.length) {
      // Books already in the collection keep their original added date.
      await tx
        .insert(collectionBooks)
        .values(ids.map((bookId) => ({ collectionId, bookId })))
        .onConflictDoNothing();
    }
  });
}

export const collectionsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireUser);

  app.get('/collections', async (req) => summaries(app.db, req.user!.id));

  app.post('/collections', async (req, reply) => {
    const body = z.object({ name, bookIds: bookIds.default([]) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Invalid collection' });
    const ids = await ownedBookIds(app.db, req.user!.id, body.data.bookIds);
    if (!ids) return reply.code(400).send({ error: 'Some of those books are not on your shelf.' });

    let created;
    try {
      [created] = await app.db
        .insert(collections)
        .values({ userId: req.user!.id, name: body.data.name })
        .returning({ id: collections.id });
    } catch (err) {
      if (isUniqueViolation(err)) return duplicate(reply, body.data.name);
      throw err;
    }
    await replaceBooks(app.db, created!.id, ids);
    const [summary] = await summaries(app.db, req.user!.id, [created!.id]);
    return reply.code(201).send(summary);
  });

  app.get<{ Params: { id: string } }>('/collections/:id', async (req, reply) => {
    const collection = await findOwned(app.db, req.user!.id, req.params.id);
    if (!collection) return notFound(reply);
    const rows = await app.db
      .select({ ...summaryColumns, addedToCollectionAt: collectionBooks.addedAt })
      .from(collectionBooks)
      .innerJoin(books, eq(books.id, collectionBooks.bookId))
      .leftJoin(progress, eq(progress.bookId, books.id))
      .where(eq(collectionBooks.collectionId, collection.id))
      .orderBy(desc(collectionBooks.addedAt), desc(books.addedAt));
    const body: CollectionDetail = {
      id: collection.id,
      name: collection.name,
      createdAt: collection.createdAt.toISOString(),
      books: rows.map(
        ({ addedToCollectionAt, ...row }): CollectionBook => ({
          ...toSummary(row as SummaryRow),
          addedToCollectionAt: addedToCollectionAt.toISOString(),
        }),
      ),
    };
    return body;
  });

  app.patch<{ Params: { id: string } }>('/collections/:id', async (req, reply) => {
    const collection = await findOwned(app.db, req.user!.id, req.params.id);
    if (!collection) return notFound(reply);
    const body = z.object({ name }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Invalid name' });
    try {
      await app.db.update(collections).set({ name: body.data.name }).where(eq(collections.id, collection.id));
    } catch (err) {
      if (isUniqueViolation(err)) return duplicate(reply, body.data.name);
      throw err;
    }
    const [summary] = await summaries(app.db, req.user!.id, [collection.id]);
    return summary;
  });

  app.put<{ Params: { id: string } }>('/collections/:id/books', async (req, reply) => {
    const collection = await findOwned(app.db, req.user!.id, req.params.id);
    if (!collection) return notFound(reply);
    const body = z.object({ bookIds }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid book list' });
    const ids = await ownedBookIds(app.db, req.user!.id, body.data.bookIds);
    if (!ids) return reply.code(400).send({ error: 'Some of those books are not on your shelf.' });
    await replaceBooks(app.db, collection.id, ids);
    const [summary] = await summaries(app.db, req.user!.id, [collection.id]);
    return summary;
  });

  app.delete<{ Params: { id: string } }>('/collections/:id', async (req, reply) => {
    const collection = await findOwned(app.db, req.user!.id, req.params.id);
    if (!collection) return notFound(reply);
    await app.db.delete(collections).where(eq(collections.id, collection.id));
    return reply.code(204).send();
  });
};
