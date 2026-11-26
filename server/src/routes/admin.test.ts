import type { AdminPasswordReset, AdminRow, AdminRowsResponse, AdminTable, BookSummary, User } from '@athenaeum/shared';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { users } from '../db/schema.ts';
import { makeEpub } from '../test/fixtures/epub.ts';
import { sameOrigin, sessionToken, signUp, testApp, uploadAs, withSession } from '../test/helpers.ts';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

describe('admin API', async () => {
  const { app, db } = await testApp();

  const call = (method: Method, url: string, token: string | null, payload?: object) =>
    app.inject({ method, url, headers: token ? withSession(token) : sameOrigin, payload });

  const me = async (token: string) => (await call('GET', '/api/auth/me', token)).json<{ user: User }>().user;

  async function setAdmin(token: string, isAdmin = true) {
    const { id } = await me(token);
    await db.update(users).set({ isAdmin }).where(eq(users.id, id));
  }

  async function addBook(token: string, title: string): Promise<BookSummary> {
    const epub = await makeEpub({
      title,
      files: [
        { name: 'c1.xhtml', body: `<h1>One</h1><p>First chapter of ${title}.</p>` },
        { name: 'c2.xhtml', body: `<h1>Two</h1><p>Second chapter of ${title}.</p>` },
      ],
      toc: [
        { label: 'One', href: 'c1.xhtml' },
        { label: 'Two', href: 'c2.xhtml' },
      ],
    });
    return (await uploadAs(app, token, `${title}.epub`, epub)).json<BookSummary>();
  }

  const rows = async (table: string, query = '', token = admin) => {
    const res = await call('GET', `/api/admin/tables/${table}/rows${query}`, token);
    expect(res.statusCode).toBe(200);
    return res.json<AdminRowsResponse>();
  };

  const update = (table: string, key: AdminRow, values: AdminRow, token = admin) =>
    call('PATCH', `/api/admin/tables/${table}/rows`, token, { key, values });

  const remove = (table: string, key: AdminRow, token = admin) =>
    call('DELETE', `/api/admin/tables/${table}/rows`, token, { key });

  let admin: string;
  let adminUser: User;
  let reader: string;
  let readerUser: User;
  let book: BookSummary;
  /** Makes titles unique to this run, so searches only find this file's rows. */
  const tag = randomUUID().slice(0, 8);

  beforeAll(async () => {
    admin = await signUp(app, 'admin');
    await setAdmin(admin);
    adminUser = await me(admin);
    reader = await signUp(app, 'reader');
    readerUser = await me(reader);
    book = await addBook(reader, `Dune ${tag}`);
  });

  describe('who can use it', () => {
    const everyRoute = (): [Method, string, object?][] => [
      ['GET', '/api/admin/tables'],
      ['GET', '/api/admin/tables/books/rows'],
      ['PATCH', '/api/admin/tables/books/rows', { key: { id: book.id }, values: { title: 'Hacked' } }],
      ['DELETE', '/api/admin/tables/books/rows', { key: { id: book.id } }],
      ['POST', `/api/admin/users/${readerUser.id}/reset-password`],
    ];

    it('answers 404 to signed-out visitors, as if it did not exist', async () => {
      for (const [method, url, payload] of everyRoute()) {
        const res = await call(method, url, null, payload);
        expect(res.statusCode, `${method} ${url}`).toBe(404);
      }
    });

    it('answers 404 to signed-in users who are not admins, and changes nothing', async () => {
      for (const [method, url, payload] of everyRoute()) {
        const res = await call(method, url, reader, payload);
        expect(res.statusCode, `${method} ${url}`).toBe(404);
      }
      const still = await call('GET', `/api/books/${book.id}`, reader);
      expect(still.json()).toMatchObject({ title: `Dune ${tag}` });
    });

    it('lets admins in', async () => {
      expect((await call('GET', '/api/admin/tables', admin)).statusCode).toBe(200);
    });

    it('notices at once when someone stops being an admin', async () => {
      const other = await signUp(app, 'demoted');
      await setAdmin(other);
      expect((await call('GET', '/api/admin/tables', other)).statusCode).toBe(200);
      await setAdmin(other, false);
      expect((await call('GET', '/api/admin/tables', other)).statusCode).toBe(404);
    });

    it('does not tell the app who is an admin', async () => {
      const res = await call('GET', '/api/auth/me', admin);
      expect(res.json().user).not.toHaveProperty('isAdmin');
    });
  });

  describe('listing tables', () => {
    let tables: AdminTable[];
    const table = (name: string) => tables.find((t) => t.name === name)!;
    const column = (t: string, c: string) => table(t).columns.find((col) => col.name === c);

    beforeAll(async () => {
      tables = (await call('GET', '/api/admin/tables', admin)).json<AdminTable[]>();
    });

    it('lists every table with its row count', () => {
      expect(tables.map((t) => t.name).sort()).toEqual(
        [
          'book_files',
          'book_images',
          'books',
          'chapter_reads',
          'chapters',
          'collection_books',
          'collections',
          'progress',
          'sessions',
          'user_settings',
          'users',
        ].sort(),
      );
      expect(table('users').rowCount).toBeGreaterThanOrEqual(2);
      expect(table('books').rowCount).toBeGreaterThanOrEqual(1);
    });

    it('never mentions password hashes', () => {
      expect(column('users', 'password_hash')).toBeUndefined();
    });

    it('describes each column so the dashboard can show and edit it', () => {
      expect(table('books').primaryKey).toEqual(['id']);
      expect(column('books', 'id')).toMatchObject({ type: 'uuid', primaryKey: true, editable: false });
      expect(column('books', 'title')).toMatchObject({ type: 'text', nullable: false, editable: true });
      expect(column('books', 'author')).toMatchObject({ type: 'text', nullable: true, editable: true });
      expect(column('books', 'format')).toMatchObject({ type: 'enum', enumValues: ['epub', 'pdf', 'docx', 'txt'] });
      expect(column('books', 'cover')).toMatchObject({ type: 'binary', editable: false });
      expect(column('books', 'word_count')).toMatchObject({ type: 'integer', editable: true });
      expect(column('books', 'last_read_at')).toMatchObject({ type: 'timestamp', nullable: true });
      expect(column('books', 'user_id')).toMatchObject({ type: 'uuid', references: 'users', editable: true });
      expect(column('users', 'is_admin')).toMatchObject({ type: 'boolean', editable: true });
      expect(column('chapters', 'blocks')).toMatchObject({ type: 'json', editable: false });
      expect(column('progress', 'percent')).toMatchObject({ type: 'number' });
      expect(table('chapter_reads').primaryKey).toEqual(['book_id', 'chapter_index']);
    });
  });

  describe('browsing rows', () => {
    it('finds rows by searching text columns, without password hashes', async () => {
      const page = await rows('users', `?q=${encodeURIComponent(readerUser.email)}`);
      expect(page.total).toBe(1);
      expect(page.rows[0]).toEqual({
        id: readerUser.id,
        email: readerUser.email,
        is_admin: false,
        created_at: readerUser.createdAt,
      });
    });

    it('finds rows by id, including ids in foreign key columns', async () => {
      expect((await rows('books', `?q=${book.id}`)).rows.map((r) => r.id)).toEqual([book.id]);
      const chapters = await rows('chapters', `?q=${book.id}&sort=index&dir=asc`);
      expect(chapters.rows.map((r) => [r.book_id, r.index, r.title])).toEqual([
        [book.id, 0, 'One'],
        [book.id, 1, 'Two'],
      ]);
    });

    it('shows file sizes instead of file bytes, and a short preview of JSON', async () => {
      const [file] = (await rows('book_files', `?q=${book.id}`)).rows;
      expect(file!.data).toBeGreaterThan(100);
      const [chapter] = (await rows('chapters', `?q=${book.id}&sort=index&dir=asc`)).rows;
      expect(typeof chapter!.blocks).toBe('string');
      expect(chapter!.blocks).toContain(`First chapter of Dune ${tag}`);
    });

    it('sorts by any column and pages through the results', async () => {
      for (const n of [3, 1, 2]) await addBook(reader, `Sortable ${tag} ${n}`);
      const q = encodeURIComponent(`Sortable ${tag}`);
      const asc = await rows('books', `?q=${q}&sort=title&dir=asc`);
      expect(asc.rows.map((r) => r.title)).toEqual([1, 2, 3].map((n) => `Sortable ${tag} ${n}`));
      const desc = await rows('books', `?q=${q}&sort=title&dir=desc`);
      expect(desc.rows.map((r) => r.title)).toEqual([3, 2, 1].map((n) => `Sortable ${tag} ${n}`));
      expect(desc).toMatchObject({ total: 3, page: 1, pageSize: 50 });
      expect((await rows('books', `?q=${q}&page=2`)).rows).toEqual([]);
    });

    it('rejects unknown tables, unknown sort columns and bad pages', async () => {
      expect((await call('GET', '/api/admin/tables/pg_user/rows', admin)).statusCode).toBe(404);
      expect((await call('GET', '/api/admin/tables/books/rows?sort=password_hash', admin)).statusCode).toBe(400);
      expect((await call('GET', '/api/admin/tables/users/rows?sort=password_hash', admin)).statusCode).toBe(400);
      expect((await call('GET', '/api/admin/tables/books/rows?page=0', admin)).statusCode).toBe(400);
    });
  });

  describe('editing a row', () => {
    it("changes the value, and the owner sees it in the app", async () => {
      const res = await update('books', { id: book.id }, { title: `Dune Messiah ${tag}`, author: 'Frank Herbert' });
      expect(res.statusCode).toBe(200);
      expect(res.json<AdminRow>()).toMatchObject({ id: book.id, title: `Dune Messiah ${tag}`, author: 'Frank Herbert' });
      const seen = await call('GET', `/api/books/${book.id}`, reader);
      expect(seen.json()).toMatchObject({ title: `Dune Messiah ${tag}`, author: 'Frank Herbert' });
    });

    it('accepts null for nullable columns and ISO dates for timestamps', async () => {
      const when = '2026-01-02T03:04:05.000Z';
      const res = await update('books', { id: book.id }, { author: null, last_read_at: when });
      expect(res.json<AdminRow>()).toMatchObject({ author: null, last_read_at: when });
    });

    it('rejects values of the wrong type, read-only columns and unknown columns', async () => {
      const bad: AdminRow[] = [
        { word_count: 'many' },
        { word_count: 1.5 },
        { format: 'mobi' },
        { title: null },
        { title: '' },
        { last_read_at: 'yesterday' },
        { id: randomUUID() },
        { cover: null },
        { nonsense: 1 },
        {},
      ];
      for (const values of bad) {
        const res = await update('books', { id: book.id }, values);
        expect(res.statusCode, JSON.stringify(values)).toBe(400);
      }
      expect((await update('users', { id: readerUser.id }, { password_hash: 'x' })).statusCode).toBe(400);
    });

    it('reports a missing row as 404 and an incomplete key as 400', async () => {
      expect((await update('books', { id: randomUUID() }, { title: 'X' })).statusCode).toBe(404);
      expect((await update('books', { id: 'not-a-uuid' }, { title: 'X' })).statusCode).toBe(404);
      expect((await update('chapter_reads', { book_id: book.id }, { chapter_index: 1 })).statusCode).toBe(400);
    });

    it('stores emails in lowercase and refuses one that is taken', async () => {
      const fresh = await signUp(app, 'renamed');
      const { id } = await me(fresh);
      const email = `Renamed-${tag}@Test.Local`;
      expect((await update('users', { id }, { email })).json<AdminRow>().email).toBe(email.toLowerCase());
      const taken = await update('users', { id }, { email: readerUser.email });
      expect(taken.statusCode).toBe(409);
    });

    it('refuses to point a row at something that does not exist', async () => {
      const res = await update('books', { id: book.id }, { user_id: randomUUID() });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/doesn.t exist/);
    });

    it('can make someone else an admin, but you cannot remove your own admin rights', async () => {
      const helper = await signUp(app, 'helper');
      const { id } = await me(helper);
      expect((await update('users', { id }, { is_admin: true })).statusCode).toBe(200);
      expect((await call('GET', '/api/admin/tables', helper)).statusCode).toBe(200);

      const res = await update('users', { id: adminUser.id }, { is_admin: false });
      expect(res.statusCode).toBe(400);
      expect((await call('GET', '/api/admin/tables', admin)).statusCode).toBe(200);
    });
  });

  describe('deleting a row', () => {
    it("deletes it along with everything that belongs to it", async () => {
      const doomed = await addBook(reader, `Doomed ${tag}`);
      const res = await remove('books', { id: doomed.id });
      expect(res.statusCode).toBe(204);
      expect((await call('GET', `/api/books/${doomed.id}`, reader)).statusCode).toBe(404);
      expect((await rows('chapters', `?q=${doomed.id}`)).total).toBe(0);
    });

    it('deletes rows with two-column keys', async () => {
      await app.inject({
        method: 'PUT',
        url: `/api/books/${book.id}/chapters/0/read`,
        headers: withSession(reader),
        payload: { read: true },
      });
      expect((await rows('chapter_reads', `?q=${book.id}`)).total).toBe(1);
      expect((await remove('chapter_reads', { book_id: book.id, chapter_index: 0 })).statusCode).toBe(204);
      expect((await rows('chapter_reads', `?q=${book.id}`)).total).toBe(0);
    });

    it('reports a missing row as 404', async () => {
      expect((await remove('books', { id: randomUUID() })).statusCode).toBe(404);
    });

    it('will not delete your own account', async () => {
      const res = await remove('users', { id: adminUser.id });
      expect(res.statusCode).toBe(400);
      expect((await call('GET', '/api/admin/tables', admin)).statusCode).toBe(200);
    });
  });

  describe('resetting a password', () => {
    it('gives the account a temporary password and signs it out everywhere', async () => {
      const victim = await signUp(app, 'forgetful');
      const { id, email } = await me(victim);
      const res = await call('POST', `/api/admin/users/${id}/reset-password`, admin);
      expect(res.statusCode).toBe(200);
      const { password } = res.json<AdminPasswordReset>();
      expect(password).toHaveLength(16);

      expect((await call('GET', '/api/books', victim)).statusCode).toBe(401);
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: sameOrigin,
        payload: { email, password },
      });
      expect(login.statusCode).toBe(200);
      expect(sessionToken(login)).toBeTruthy();
    });

    it('reports an unknown user as 404', async () => {
      expect((await call('POST', `/api/admin/users/${randomUUID()}/reset-password`, admin)).statusCode).toBe(404);
      expect((await call('POST', '/api/admin/users/nope/reset-password', admin)).statusCode).toBe(404);
    });
  });
});
