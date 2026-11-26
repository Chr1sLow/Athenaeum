import { describe, expect, it } from 'vitest';
import { testApp } from '../test/helpers.ts';

describe('migrations', () => {
  it('create every table from the plan', async () => {
    const { sql } = await testApp();
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`;
    expect(rows.map((r) => r.table_name)).toEqual([
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
    ]);
  });

  it('cascade-delete a user to all of their books and child rows', async () => {
    const { sql } = await testApp();
    const [user] = await sql<{ id: string }[]>`
      insert into users (email, password_hash) values ('cascade@test.local', 'x') returning id`;
    const [book] = await sql<{ id: string }[]>`
      insert into books (user_id, title, format) values (${user!.id}, 'T', 'txt') returning id`;
    await sql`insert into chapters (book_id, index, title, blocks) values (${book!.id}, 0, 'C', '[]')`;
    await sql`insert into progress (book_id) values (${book!.id})`;

    await sql`delete from users where id = ${user!.id}`;

    const [left] = await sql<{ n: string }[]>`
      select (select count(*) from books where id = ${book!.id})
           + (select count(*) from chapters where book_id = ${book!.id})
           + (select count(*) from progress where book_id = ${book!.id}) as n`;
    expect(Number(left!.n)).toBe(0);
  });
});
