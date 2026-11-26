import type { BookDetail, BookSummary, Chapter, Progress } from '@athenaeum/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { books, chapters } from '../db/schema.ts';
import { PNG_1PX, makeEpub } from '../test/fixtures/epub.ts';
import { makePdf } from '../test/fixtures/pdf.ts';
import { multipartFile, sameOrigin, signUp, testApp, uploadAs, withSession } from '../test/helpers.ts';

const EPUB_SPEC = {
  title: 'The Lantern Road',
  author: 'Mara Quill',
  description: 'A quiet story.',
  files: [
    { name: 'c1.xhtml', body: '<h1>One</h1><p>The river was silver.</p><p><img src="map.png" alt="Map"/></p>' },
    { name: 'c2.xhtml', body: '<h1>Two</h1><p>She walked on, and on.</p>' },
  ],
  toc: [
    { label: 'One', href: 'c1.xhtml' },
    { label: 'Two', href: 'c2.xhtml' },
  ],
  images: [
    { name: 'cover.png', mime: 'image/png', data: PNG_1PX, cover: true },
    { name: 'map.png', mime: 'image/png', data: PNG_1PX },
  ],
};

describe('books API', async () => {
  const { app, db } = await testApp();
  let epub: Buffer;
  let token: string;

  beforeAll(async () => {
    epub = await makeEpub(EPUB_SPEC);
    token = await signUp(app);
  });

  const get = (url: string, t = token) => app.inject({ method: 'GET', url, headers: withSession(t) });
  const put = (url: string, payload: object, t = token) =>
    app.inject({ method: 'PUT', url, headers: withSession(t), payload });
  const uploadEpub = async (t = token) => (await uploadAs(app, t, 'lantern.epub', epub, 'application/epub+zip')).json<BookSummary>();

  describe('POST /api/books', () => {
    it('imports an EPUB and returns it as a shelf entry', async () => {
      const res = await uploadAs(app, token, 'lantern.epub', epub, 'application/epub+zip');
      expect(res.statusCode).toBe(201);
      expect(res.json<BookSummary>()).toMatchObject({
        title: 'The Lantern Road',
        author: 'Mara Quill',
        format: 'epub',
        hasCover: true,
        chapterCount: 2,
        wordCount: 9,
        percent: 0,
        chapterIndex: 0,
        lastReadAt: null,
      });
    });

    it('imports a PDF', async () => {
      const pdf = await makePdf({ title: 'A Paper Book', pages: [['It was a bright cold day in April.']] });
      const res = await uploadAs(app, token, 'paper.pdf', pdf, 'application/pdf');
      expect(res.statusCode).toBe(201);
      expect(res.json<BookSummary>()).toMatchObject({ title: 'A Paper Book', format: 'pdf', hasCover: true, chapterCount: 1 });
    });

    it('detects the format from the file contents, not the name', async () => {
      const res = await uploadAs(app, token, 'renamed.bin', epub);
      expect(res.statusCode).toBe(201);
      expect(res.json<BookSummary>().format).toBe('epub');
    });

    it('keeps the original file, byte for byte', async () => {
      const book = await uploadEpub();
      const res = await get(`/api/books/${book.id}/file`);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/epub+zip');
      expect(res.headers['content-disposition']).toBe('attachment; filename="lantern.epub"');
      expect(res.rawPayload.equals(epub)).toBe(true);
    });

    it('rejects file types it cannot read with 415', async () => {
      const res = await uploadAs(app, token, 'notes.txt', Buffer.from('just some text'), 'text/plain');
      expect(res.statusCode).toBe(415);
      expect(res.json().error).toMatch(/EPUB or PDF/);
    });

    it('rejects a damaged EPUB with 422 and stores nothing', async () => {
      const before = (await get('/api/books')).json<BookSummary[]>().length;
      const broken = Buffer.concat([epub.subarray(0, 200)]);
      const res = await uploadAs(app, token, 'broken.epub', broken, 'application/epub+zip');
      expect(res.statusCode).toBe(422);
      expect((await get('/api/books')).json<BookSummary[]>()).toHaveLength(before);
    });

    it('rejects a request with no file', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/books', headers: withSession(token), payload: {} });
      expect(res.statusCode).toBe(400);
    });

    it('rejects files over the upload limit with 413', async () => {
      const small = await testApp({ maxUploadMb: 0.001 }); // ~1 KB
      const t = await signUp(small.app);
      const res = await uploadAs(small.app, t, 'big.epub', epub, 'application/epub+zip');
      expect(res.statusCode).toBe(413);
    });

    it('requires a signed-in user', async () => {
      const body = multipartFile('lantern.epub', epub);
      const res = await app.inject({ method: 'POST', url: '/api/books', headers: { ...sameOrigin, ...body.headers }, payload: body.payload });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('reading a book', () => {
    let book: BookSummary;
    beforeAll(async () => {
      book = await uploadEpub();
    });

    it('lists the shelf without any file or image bytes', async () => {
      const res = await get('/api/books');
      expect(res.statusCode).toBe(200);
      const shelf = res.json<BookSummary[]>();
      expect(shelf.map((b) => b.id)).toContain(book.id);
      expect(res.body).not.toContain('"cover"');
      expect(res.body).not.toContain('"data"');
    });

    it('returns details with the chapter list', async () => {
      const detail = (await get(`/api/books/${book.id}`)).json<BookDetail>();
      expect(detail).toMatchObject({
        id: book.id,
        description: 'A quiet story.',
        filename: 'lantern.epub',
        sizeBytes: epub.length,
        progress: null,
      });
      expect(detail.chapters).toEqual([
        { index: 0, title: 'One', wordCount: 4, read: false },
        { index: 1, title: 'Two', wordCount: 5, read: false },
      ]);
    });

    it('serves one chapter at a time', async () => {
      const res = await get(`/api/books/${book.id}/chapters/1`);
      expect(res.json<Chapter>()).toEqual({
        bookId: book.id,
        index: 1,
        title: 'Two',
        wordCount: 5,
        blocks: [{ type: 'p', text: 'She walked on, and on.' }],
        gallery: [],
      });
      expect((await get(`/api/books/${book.id}/chapters/2`)).statusCode).toBe(404);
      expect((await get(`/api/books/${book.id}/chapters/abc`)).statusCode).toBe(404);
    });

    it('serves illustrations referenced by image blocks', async () => {
      const chapter = (await get(`/api/books/${book.id}/chapters/0`)).json<Chapter>();
      const img = chapter.blocks.find((b) => b.type === 'img') as { imageId: string };
      const res = await get(`/api/books/${book.id}/images/${img.imageId}`);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.rawPayload.equals(PNG_1PX)).toBe(true);
    });

    it("serves a PDF chapter's illustrations through its gallery", async () => {
      const pdf = await makePdf({
        pages: [['It was a bright cold day in April, and the clocks were striking thirteen.'], []],
        images: [{ page: 1, width: 300, height: 400 }],
      });
      const paper = (await uploadAs(app, token, 'paper.pdf', pdf, 'application/pdf')).json<BookSummary>();
      const chapter = (await get(`/api/books/${paper.id}/chapters/0`)).json<Chapter>();
      expect(chapter.gallery).toEqual([{ imageId: expect.any(String), width: 300, height: 400 }]);
      const res = await get(`/api/books/${paper.id}/images/${chapter.gallery[0]!.imageId}`);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
      // Someone else can't see it.
      const other = await signUp(app);
      expect((await get(`/api/books/${paper.id}/images/${chapter.gallery[0]!.imageId}`, other)).statusCode).toBe(404);
    });

    it('serves the cover image', async () => {
      const res = await get(`/api/books/${book.id}/cover`);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.rawPayload.equals(PNG_1PX)).toBe(true);
    });

    it('returns 404 for the cover of a book that has none', async () => {
      const plain = await makeEpub({ title: 'No Cover', files: [{ name: 'c.xhtml', body: '<p>Text.</p>' }] });
      const noCover = (await uploadAs(app, token, 'plain.epub', plain)).json<BookSummary>();
      expect(noCover.hasCover).toBe(false);
      expect((await get(`/api/books/${noCover.id}/cover`)).statusCode).toBe(404);
    });
  });

  describe('progress', () => {
    it('saves your place and shows it on the shelf', async () => {
      const book = await uploadEpub();
      const res = await put(`/api/books/${book.id}/progress`, { chapterIndex: 1, blockIndex: 3, percent: 62.5 });
      expect(res.statusCode).toBe(200);
      expect(res.json<Progress>()).toMatchObject({ chapterIndex: 1, blockIndex: 3, percent: 62.5 });

      expect((await get(`/api/books/${book.id}/progress`)).json<Progress>()).toMatchObject({ chapterIndex: 1, blockIndex: 3 });
      const onShelf = (await get('/api/books')).json<BookSummary[]>().find((b) => b.id === book.id)!;
      expect(onShelf).toMatchObject({ percent: 62.5, chapterIndex: 1 });
      expect(onShelf.lastReadAt).not.toBeNull();
    });

    it('puts the most recently read book first', async () => {
      const older = await uploadEpub();
      await uploadEpub();
      await put(`/api/books/${older.id}/progress`, { chapterIndex: 0, blockIndex: 0, percent: 1 });
      expect((await get('/api/books')).json<BookSummary[]>()[0]!.id).toBe(older.id);
    });

    it('returns null progress for a book never opened', async () => {
      const book = await uploadEpub();
      const res = await get(`/api/books/${book.id}/progress`);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toBeNull();
    });

    it.each([
      [{ chapterIndex: 2, blockIndex: 0, percent: 10 }, 'chapter past the end'],
      [{ chapterIndex: -1, blockIndex: 0, percent: 10 }, 'negative chapter'],
      [{ chapterIndex: 0, blockIndex: 0, percent: 101 }, 'percent over 100'],
      [{ chapterIndex: 0 }, 'missing fields'],
    ])('rejects invalid progress (%o: %s)', async (body, _why) => {
      const book = await uploadEpub();
      expect((await put(`/api/books/${book.id}/progress`, body)).statusCode).toBe(400);
    });

    it('marks chapters read and unread', async () => {
      const book = await uploadEpub();
      expect((await put(`/api/books/${book.id}/chapters/0/read`, { read: true })).statusCode).toBe(204);
      expect((await get(`/api/books/${book.id}`)).json<BookDetail>().chapters.map((c) => c.read)).toEqual([true, false]);
      await put(`/api/books/${book.id}/chapters/0/read`, { read: false });
      expect((await get(`/api/books/${book.id}`)).json<BookDetail>().chapters.map((c) => c.read)).toEqual([false, false]);
    });
  });

  describe('PUT /api/books/:id/pin', () => {
    const shelfEntry = async (id: string) => (await get('/api/books')).json<BookSummary[]>().find((b) => b.id === id)!;

    it('starts unpinned', async () => {
      const book = await uploadEpub();
      expect(book.pinned).toBe(false);
      expect((await shelfEntry(book.id)).pinned).toBe(false);
    });

    it('pins and unpins a book, shown on the shelf and the book page', async () => {
      const book = await uploadEpub();
      expect((await put(`/api/books/${book.id}/pin`, { pinned: true })).statusCode).toBe(204);
      expect((await shelfEntry(book.id)).pinned).toBe(true);
      expect((await get(`/api/books/${book.id}`)).json<BookDetail>().pinned).toBe(true);

      expect((await put(`/api/books/${book.id}/pin`, { pinned: false })).statusCode).toBe(204);
      expect((await shelfEntry(book.id)).pinned).toBe(false);
    });

    it.each([[{}], [{ pinned: 'yes' }]])('rejects an invalid body (%o) with 400', async (body) => {
      const book = await uploadEpub();
      expect((await put(`/api/books/${book.id}/pin`, body)).statusCode).toBe(400);
    });
  });

  describe('DELETE /api/books/:id', () => {
    it('removes the book and everything stored with it', async () => {
      const book = await uploadEpub();
      const res = await app.inject({ method: 'DELETE', url: `/api/books/${book.id}`, headers: withSession(token) });
      expect(res.statusCode).toBe(204);
      expect((await get(`/api/books/${book.id}`)).statusCode).toBe(404);
      expect(await db.select().from(books).where(eq(books.id, book.id))).toHaveLength(0);
      expect(await db.select().from(chapters).where(eq(chapters.bookId, book.id))).toHaveLength(0);
    });
  });

  describe("another user's books", () => {
    let book: BookSummary;
    let imageId: string;
    let other: string;

    beforeAll(async () => {
      book = await uploadEpub();
      const chapter = (await get(`/api/books/${book.id}/chapters/0`)).json<Chapter>();
      imageId = (chapter.blocks.find((b) => b.type === 'img') as { imageId: string }).imageId;
      other = await signUp(app, 'other');
    });

    it('are not on your shelf', async () => {
      expect((await get('/api/books', other)).json<BookSummary[]>()).toEqual([]);
    });

    it.each([
      ['GET', ''],
      ['GET', '/cover'],
      ['GET', '/file'],
      ['GET', '/chapters/0'],
      ['GET', '/progress'],
      ['GET', `/images/IMAGE`],
      ['PUT', '/progress'],
      ['PUT', '/chapters/0/read'],
      ['PUT', '/pin'],
      ['DELETE', ''],
    ])('return 404 for %s /api/books/:id%s', async (method, suffix) => {
      const url = `/api/books/${book.id}${suffix.replace('IMAGE', imageId)}`;
      const payload = method === 'PUT' ? { chapterIndex: 0, blockIndex: 0, percent: 0, read: true, pinned: true } : undefined;
      const res = await app.inject({ method: method as 'GET', url, headers: withSession(other), payload });
      expect(res.statusCode).toBe(404);
    });

    it('stay untouched after those attempts', async () => {
      const res = await get(`/api/books/${book.id}`);
      expect(res.statusCode).toBe(200);
      expect(res.json<BookDetail>().pinned).toBe(false);
      expect((await get(`/api/books/${book.id}/progress`)).json()).toBeNull();
    });

    it('cannot be reached with a malformed id either', async () => {
      expect((await get('/api/books/not-a-uuid')).statusCode).toBe(404);
      expect((await get(`/api/books/${book.id}/images/not-a-uuid`)).statusCode).toBe(404);
    });
  });

  it('requires a signed-in user to list books', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/books' })).statusCode).toBe(401);
  });
});
