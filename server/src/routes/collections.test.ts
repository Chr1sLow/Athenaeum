import type { BookSummary, CollectionDetail, CollectionSummary } from '@athenaeum/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeEpub } from '../test/fixtures/epub.ts';
import { signUp, testApp, uploadAs, withSession } from '../test/helpers.ts';

describe('collections API', async () => {
  const { app } = await testApp();
  let token: string;

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: object, t = token) =>
    app.inject({ method, url, headers: withSession(t), payload });

  async function addBook(title: string, t = token): Promise<BookSummary> {
    const epub = await makeEpub({ title, files: [{ name: 'c1.xhtml', body: `<p>Text of ${title}.</p>` }] });
    return (await uploadAs(app, t, `${title}.epub`, epub)).json<BookSummary>();
  }

  async function create(name: string, bookIds: string[] = [], t = token) {
    return call('POST', '/api/collections', { name, bookIds }, t);
  }

  let dune: BookSummary;
  let emma: BookSummary;
  let ivanhoe: BookSummary;

  beforeAll(async () => {
    token = await signUp(app, 'collector');
    dune = await addBook('Dune');
    emma = await addBook('Emma');
    ivanhoe = await addBook('Ivanhoe');
  });

  describe('creating', () => {
    it('creates a named collection holding the chosen books', async () => {
      const res = await create('Favorites', [dune.id, emma.id]);
      expect(res.statusCode).toBe(201);
      const created = res.json<CollectionSummary>();
      expect(created).toMatchObject({ name: 'Favorites', bookCount: 2 });
      expect(created.previewBooks.map((b) => b.id).sort()).toEqual([dune.id, emma.id].sort());
    });

    it('can start empty', async () => {
      const res = await create('Someday');
      expect(res.statusCode).toBe(201);
      expect(res.json<CollectionSummary>().bookCount).toBe(0);
    });

    it('trims the name', async () => {
      expect((await create('   Spaced Out   ')).json<CollectionSummary>().name).toBe('Spaced Out');
    });

    it.each([
      ['', 'empty'],
      ['    ', 'only spaces'],
      ['x'.repeat(81), 'over 80 characters'],
    ])('rejects a bad name (%j: %s)', async (name, _why) => {
      expect((await create(name)).statusCode).toBe(400);
    });

    it('rejects a name you already use, whatever its capitalization', async () => {
      await create('Summer Reads');
      const res = await create('summer reads');
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/already have a collection/);
    });

    it('ignores a book listed twice', async () => {
      const res = await create('Twice', [dune.id, dune.id]);
      expect(res.json<CollectionSummary>().bookCount).toBe(1);
    });
  });

  describe('reading', () => {
    it('lists your collections alphabetically with their book counts', async () => {
      const t = await signUp(app, 'lister');
      const a = await addBook('A Book', t);
      await create('Zebra', [a.id], t);
      await create('apple', [], t);
      await create('Mango', [a.id], t);
      const list = (await call('GET', '/api/collections', undefined, t)).json<CollectionSummary[]>();
      expect(list.map((c) => [c.name, c.bookCount])).toEqual([
        ['apple', 0],
        ['Mango', 1],
        ['Zebra', 1],
      ]);
    });

    it('shows a collection with its books, most recently added first', async () => {
      const id = (await create('Ordered', [dune.id])).json<CollectionSummary>().id;
      await call('PUT', `/api/collections/${id}/books`, { bookIds: [dune.id, ivanhoe.id] });
      const detail = (await call('GET', `/api/collections/${id}`)).json<CollectionDetail>();
      expect(detail.name).toBe('Ordered');
      expect(detail.books.map((b) => b.title)).toEqual(['Ivanhoe', 'Dune']);
      expect(detail.books[0]).toMatchObject({ id: ivanhoe.id, format: 'epub', chapterCount: 1 });
      expect(new Date(detail.books[0]!.addedToCollectionAt).getTime()).toBeGreaterThanOrEqual(
        new Date(detail.books[1]!.addedToCollectionAt).getTime(),
      );
    });

    it('previews at most four books', async () => {
      const extra = await Promise.all(['F1', 'F2', 'F3'].map((t) => addBook(t)));
      const id = (await create('Five', [dune.id, emma.id, ...extra.map((b) => b.id)])).json<CollectionSummary>().id;
      const summary = (await call('GET', '/api/collections')).json<CollectionSummary[]>().find((c) => c.id === id)!;
      expect(summary.bookCount).toBe(5);
      expect(summary.previewBooks).toHaveLength(4);
    });
  });

  describe('changing', () => {
    it('renames a collection', async () => {
      const id = (await create('Old Name')).json<CollectionSummary>().id;
      const res = await call('PATCH', `/api/collections/${id}`, { name: 'New Name' });
      expect(res.statusCode).toBe(200);
      expect(res.json<CollectionSummary>().name).toBe('New Name');
      expect((await call('GET', `/api/collections/${id}`)).json<CollectionDetail>().name).toBe('New Name');
    });

    it('refuses to rename onto another collection’s name', async () => {
      await create('Taken');
      const id = (await create('Free')).json<CollectionSummary>().id;
      expect((await call('PATCH', `/api/collections/${id}`, { name: 'TAKEN' })).statusCode).toBe(409);
    });

    it('allows changing only the capitalization of its own name', async () => {
      const id = (await create('lowercase')).json<CollectionSummary>().id;
      expect((await call('PATCH', `/api/collections/${id}`, { name: 'Lowercase' })).statusCode).toBe(200);
    });

    it('replaces the books, keeping the added date of books that stay', async () => {
      const id = (await create('Swap', [dune.id, emma.id])).json<CollectionSummary>().id;
      const before = (await call('GET', `/api/collections/${id}`)).json<CollectionDetail>();
      const duneAdded = before.books.find((b) => b.id === dune.id)!.addedToCollectionAt;

      const res = await call('PUT', `/api/collections/${id}/books`, { bookIds: [dune.id, ivanhoe.id] });
      expect(res.statusCode).toBe(200);
      const after = (await call('GET', `/api/collections/${id}`)).json<CollectionDetail>();
      expect(after.books.map((b) => b.id).sort()).toEqual([dune.id, ivanhoe.id].sort());
      expect(after.books.find((b) => b.id === dune.id)!.addedToCollectionAt).toBe(duneAdded);
    });

    it('deletes a collection but keeps its books on the shelf', async () => {
      const id = (await create('Temporary', [dune.id])).json<CollectionSummary>().id;
      expect((await call('DELETE', `/api/collections/${id}`)).statusCode).toBe(204);
      expect((await call('GET', `/api/collections/${id}`)).statusCode).toBe(404);
      expect((await call('GET', `/api/books/${dune.id}`)).statusCode).toBe(200);
    });

    it('drops a deleted book from its collections', async () => {
      const doomed = await addBook('Doomed');
      const id = (await create('Has Doomed', [doomed.id, emma.id])).json<CollectionSummary>().id;
      await call('DELETE', `/api/books/${doomed.id}`);
      const detail = (await call('GET', `/api/collections/${id}`)).json<CollectionDetail>();
      expect(detail.books.map((b) => b.id)).toEqual([emma.id]);
    });
  });

  describe('privacy', () => {
    let other: string;
    let mine: string;

    beforeAll(async () => {
      other = await signUp(app, 'stranger');
      mine = (await create('Private', [dune.id])).json<CollectionSummary>().id;
    });

    it("does not list another user's collections", async () => {
      expect((await call('GET', '/api/collections', undefined, other)).json()).toEqual([]);
    });

    it.each([
      ['GET', ''],
      ['PATCH', ''],
      ['PUT', '/books'],
      ['DELETE', ''],
    ] as const)("returns 404 for %s on another user's collection%s", async (method, suffix) => {
      const res = await call(method, `/api/collections/${mine}${suffix}`, { name: 'Hijacked', bookIds: [] }, other);
      expect(res.statusCode).toBe(404);
      expect((await call('GET', `/api/collections/${mine}`)).json<CollectionDetail>()).toMatchObject({
        name: 'Private',
        books: [expect.objectContaining({ id: dune.id })],
      });
    });

    it("refuses to put another user's book in your collection", async () => {
      const theirs = await addBook('Their Book', other);
      expect((await create('Sneaky', [theirs.id])).statusCode).toBe(400);
      expect((await call('PUT', `/api/collections/${mine}/books`, { bookIds: [theirs.id] })).statusCode).toBe(400);
    });

    it('returns 404 for a malformed id', async () => {
      expect((await call('GET', '/api/collections/not-a-uuid')).statusCode).toBe(404);
    });

    it('requires a signed-in user', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/collections' })).statusCode).toBe(401);
    });
  });
});
