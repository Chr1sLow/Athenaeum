import type { AdminPasswordReset, AdminRow, AdminRowsResponse, AdminTable } from '@athenaeum/shared';
import { type SQL, and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  type TableInfo,
  allTables,
  findTable,
  searchable,
  selection,
  sortable,
  toAdminTable,
  toCells,
  valueSchema,
} from '../admin/registry.ts';
import { requireAdmin } from '../auth/plugin.ts';
import { resetPassword } from '../auth/reset.ts';
import type { Db } from '../db/client.ts';
import { users } from '../db/schema.ts';

const PAGE_SIZE = 50;

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const keyBody = z.object({ key: z.record(z.string(), cell) });
const updateBody = keyBody.extend({ values: z.record(z.string(), cell) });
const rowsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(200).default(''),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

type Result<T> = { ok: true; value: T } | { ok: false; status: 400 | 404; error: string };

const badRequest = (reply: FastifyReply, error: string) => reply.code(400).send({ error });
const rowNotFound = (reply: FastifyReply) => reply.code(404).send({ error: 'Row not found' });

/** Postgres error code from a Drizzle/postgres.js error, if any. */
function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.cause?.code ?? e.code;
}

/** Turns a primary key from the request into a WHERE clause. A malformed id can't match any row: 404. */
function keyWhere(info: TableInfo, key: Record<string, unknown>): Result<SQL> {
  const parts: SQL[] = [];
  for (const c of info.primaryKey) {
    if (!(c.name in key)) return { ok: false, status: 400, error: `The row key needs ${c.name}` };
    const parsed = valueSchema(info, { ...c, nullable: false }).safeParse(key[c.name]);
    if (!parsed.success) return { ok: false, status: 404, error: 'Row not found' };
    parts.push(eq(c.column, parsed.data));
  }
  return { ok: true, value: and(...parts)! };
}

/** Validates the changed values and maps them to Drizzle property names. */
function parseChanges(info: TableInfo, values: Record<string, unknown>): Result<Record<string, unknown>> {
  const names = Object.keys(values);
  if (!names.length) return { ok: false, status: 400, error: 'Nothing to change' };
  const set: Record<string, unknown> = {};
  for (const name of names) {
    const c = info.columns.find((col) => col.name === name);
    if (!c) return { ok: false, status: 400, error: `${info.name} has no column called ${name}` };
    if (!c.editable) return { ok: false, status: 400, error: `${name} can't be edited here` };
    const parsed = valueSchema(info, c).safeParse(values[name]);
    if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? `Invalid ${name}` };
    set[c.key] = parsed.data;
  }
  return { ok: true, value: set };
}

async function selectRow(db: Db, info: TableInfo, where: SQL) {
  const [row] = await db.select(selection(info)).from(info.table).where(where).limit(1);
  return row ? toCells(row) : null;
}

/** Just enough to tell whether a write matched a row. A bare `returning()` would read file bytes back. */
const found = (info: TableInfo) => ({ key: info.primaryKey[0]!.column });

/** The row's primary key, when it is the signed-in admin's own account. */
function isOwnAccount(info: TableInfo, key: Record<string, unknown>, userId: string) {
  return info.name === 'users' && key.id === userId;
}

/**
 * The admin dashboard's API: browse and edit any table. Every route answers 404 to anyone
 * who isn't an admin (see requireAdmin), so it looks like it doesn't exist.
 */
export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAdmin);

  app.get('/admin/tables', async () => {
    const tables = allTables();
    const counts = await Promise.all(
      tables.map(async (t) => Number((await app.db.select({ n: count() }).from(t.table))[0]!.n)),
    );
    return tables.map((t, i): AdminTable => toAdminTable(t, counts[i]!));
  });

  app.get<{ Params: { table: string } }>('/admin/tables/:table/rows', async (req, reply) => {
    const info = findTable(req.params.table);
    if (!info) return reply.code(404).send({ error: 'No such table' });
    const query = rowsQuery.safeParse(req.query);
    if (!query.success) return badRequest(reply, 'Invalid page, search or sort');
    const { page, q, dir } = query.data;

    let sort = { column: info.defaultSort.column, dir: dir ?? info.defaultSort.dir };
    if (query.data.sort) {
      const column = sortable(info, query.data.sort);
      if (!column) return badRequest(reply, `Can't sort ${info.name} by ${query.data.sort}`);
      sort = { column, dir: dir ?? 'asc' };
    }

    // Plain text search: % and _ match themselves, not any characters.
    const pattern = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    const where = q
      ? or(
          ...searchable(info).map((c) =>
            c.type === 'text' ? ilike(c.column, pattern) : sql`${c.column}::text ilike ${pattern}`,
          ),
        )
      : undefined;

    const order = sort.dir === 'asc' ? asc : desc;
    const tieBreak = info.primaryKey.filter((c) => c !== sort.column).map((c) => asc(c.column));
    const [rows, [total]] = await Promise.all([
      app.db
        .select(selection(info))
        .from(info.table)
        .where(where)
        .orderBy(order(sort.column.column), ...tieBreak)
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      app.db.select({ n: count() }).from(info.table).where(where),
    ]);

    const body: AdminRowsResponse = { rows: rows.map(toCells), total: Number(total!.n), page, pageSize: PAGE_SIZE };
    return body;
  });

  app.patch<{ Params: { table: string } }>('/admin/tables/:table/rows', async (req, reply) => {
    const info = findTable(req.params.table);
    if (!info) return reply.code(404).send({ error: 'No such table' });
    const body = updateBody.safeParse(req.body);
    if (!body.success) return badRequest(reply, 'Send the row key and the values to change');

    const where = keyWhere(info, body.data.key);
    if (!where.ok) return reply.code(where.status).send({ error: where.error });
    const changes = parseChanges(info, body.data.values);
    if (!changes.ok) return reply.code(changes.status).send({ error: changes.error });
    if (isOwnAccount(info, body.data.key, req.user!.id) && body.data.values.is_admin === false) {
      return badRequest(reply, "You can't remove your own admin rights here, or you'd lock yourself out.");
    }

    try {
      const updated = await app.db.update(info.table).set(changes.value).where(where.value).returning(found(info));
      if (!updated.length) return rowNotFound(reply);
    } catch (err) {
      const code = pgCode(err);
      if (code === '23505') return reply.code(409).send({ error: 'Another row already has that value.' });
      if (code === '23503') return badRequest(reply, "That points to a row that doesn't exist.");
      throw err;
    }
    const row: AdminRow | null = await selectRow(app.db, info, where.value);
    return row ?? rowNotFound(reply);
  });

  app.delete<{ Params: { table: string } }>('/admin/tables/:table/rows', async (req, reply) => {
    const info = findTable(req.params.table);
    if (!info) return reply.code(404).send({ error: 'No such table' });
    const body = keyBody.safeParse(req.body);
    if (!body.success) return badRequest(reply, 'Send the key of the row to delete');
    const where = keyWhere(info, body.data.key);
    if (!where.ok) return reply.code(where.status).send({ error: where.error });
    if (isOwnAccount(info, body.data.key, req.user!.id)) {
      return badRequest(reply, "You can't delete your own account here, or you'd lock yourself out.");
    }

    const deleted = await app.db.delete(info.table).where(where.value).returning(found(info));
    if (!deleted.length) return rowNotFound(reply);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/admin/users/:id/reset-password', async (req, reply) => {
    const id = z.uuid().safeParse(req.params.id);
    const notFound = () => reply.code(404).send({ error: 'User not found' });
    if (!id.success) return notFound();
    const [user] = await app.db.select({ email: users.email }).from(users).where(eq(users.id, id.data));
    if (!user) return notFound();
    const password = await resetPassword(app.db, user.email);
    if (!password) return notFound();
    const body: AdminPasswordReset = { password };
    return body;
  });
};
