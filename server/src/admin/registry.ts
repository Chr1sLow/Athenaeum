// Describes every table in schema.ts for the admin dashboard, straight from Drizzle's metadata,
// so a new table or column shows up there without extra code.
import type { AdminCell, AdminColumn, AdminColumnType, AdminTable } from '@athenaeum/shared';
import { type SQL, getTableColumns, sql } from 'drizzle-orm';
import { type PgColumn, type PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import {
  bookFiles,
  bookImages,
  books,
  chapterReads,
  chapters,
  collectionBooks,
  collections,
  progress,
  sessions,
  userSettings,
  users,
} from '../db/schema.ts';

/** In the order the dashboard lists them. */
const TABLES: PgTable[] = [
  users,
  sessions,
  books,
  chapters,
  bookFiles,
  bookImages,
  progress,
  chapterReads,
  collections,
  collectionBooks,
  userSettings,
];

/** Columns the dashboard never reads or writes. */
const HIDDEN: Record<string, string[]> = { users: ['password_hash'] };

/** Characters of a JSON value shown in the table. */
const JSON_PREVIEW_CHARS = 300;

/** Newest first, when the table has one of these and no sort is chosen. */
const RECENCY_COLUMNS = ['created_at', 'added_at', 'updated_at', 'read_at'];

export interface ColumnInfo extends AdminColumn {
  /** Property name in schema.ts, used with Drizzle's `set()`. */
  key: string;
  column: PgColumn;
}

export interface TableInfo {
  name: string;
  table: PgTable;
  columns: ColumnInfo[];
  primaryKey: ColumnInfo[];
  defaultSort: { column: ColumnInfo; dir: 'asc' | 'desc' };
}

function columnType(col: PgColumn): AdminColumnType {
  switch (col.columnType) {
    case 'PgUUID':
      return 'uuid';
    case 'PgText':
    case 'PgVarchar':
      return 'text';
    case 'PgInteger':
    case 'PgSerial':
      return 'integer';
    case 'PgReal':
    case 'PgDoublePrecision':
      return 'number';
    case 'PgBoolean':
      return 'boolean';
    case 'PgTimestamp':
      return 'timestamp';
    case 'PgEnumColumn':
      return 'enum';
    case 'PgJson':
    case 'PgJsonb':
      return 'json';
  }
  if (col.getSQLType() === 'bytea') return 'binary';
  throw new Error(`Admin dashboard: no display type for ${col.columnType} (${col.name})`);
}

function describe(table: PgTable): TableInfo {
  const config = getTableConfig(table);
  const hidden = new Set(HIDDEN[config.name] ?? []);
  const compositeKey = new Set(config.primaryKeys[0]?.columns.map((c) => c.name) ?? []);
  const references = new Map<string, string>();
  for (const fk of config.foreignKeys) {
    const ref = fk.reference();
    if (ref.columns.length === 1) references.set(ref.columns[0]!.name, getTableConfig(ref.foreignTable).name);
  }

  const columns: ColumnInfo[] = Object.entries(getTableColumns(table))
    .filter(([, col]) => !hidden.has(col.name))
    .map(([key, col]) => {
      const type = columnType(col);
      const primaryKey = col.primary || compositeKey.has(col.name);
      const enumValues = type === 'enum' ? [...(col.enumValues ?? [])] : undefined;
      return {
        key,
        column: col,
        name: col.name,
        type,
        nullable: !col.notNull,
        primaryKey,
        editable: !primaryKey && type !== 'json' && type !== 'binary',
        ...(enumValues && { enumValues }),
        ...(references.has(col.name) && { references: references.get(col.name) }),
      };
    });

  const primaryKey = columns.filter((c) => c.primaryKey);
  const recency = RECENCY_COLUMNS.map((n) => columns.find((c) => c.name === n)).find(Boolean);
  return {
    name: config.name,
    table,
    columns,
    primaryKey,
    defaultSort: recency ? { column: recency, dir: 'desc' } : { column: primaryKey[0]!, dir: 'asc' },
  };
}

const REGISTRY = new Map(TABLES.map((t) => [getTableConfig(t).name, describe(t)]));

export const allTables = (): TableInfo[] => [...REGISTRY.values()];
export const findTable = (name: string): TableInfo | undefined => REGISTRY.get(name);

export function toAdminTable(info: TableInfo, rowCount: number): AdminTable {
  return {
    name: info.name,
    rowCount,
    primaryKey: info.primaryKey.map((c) => c.name),
    columns: info.columns.map(({ key: _key, column: _column, ...meta }) => meta),
  };
}

/** What the dashboard reads for each column: sizes for files, a preview for JSON, the value otherwise. */
export function selection(info: TableInfo): Record<string, PgColumn | SQL> {
  return Object.fromEntries(
    info.columns.map((c) => {
      if (c.type === 'binary') return [c.name, sql<number | null>`octet_length(${c.column})`];
      if (c.type === 'json') return [c.name, sql<string | null>`left(${c.column}::text, ${JSON_PREVIEW_CHARS})`];
      return [c.name, c.column];
    }),
  );
}

/** A database row as JSON-safe cells. */
export function toCells(row: Record<string, unknown>): Record<string, AdminCell> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : (v as AdminCell)]),
  );
}

/** Columns whose text a search looks through. */
export function searchable(info: TableInfo): ColumnInfo[] {
  return info.columns.filter((c) => c.type === 'text' || c.type === 'uuid' || c.type === 'enum');
}

export function sortable(info: TableInfo, name: string): ColumnInfo | undefined {
  return info.columns.find((c) => c.name === name && c.type !== 'binary' && c.type !== 'json');
}

/** Validates a value typed into the dashboard for one column, converting it to what Drizzle expects. */
export function valueSchema(info: TableInfo, c: ColumnInfo): z.ZodType<unknown> {
  let schema: z.ZodType<unknown>;
  switch (c.type) {
    case 'text':
      schema =
        info.name === 'users' && c.name === 'email'
          ? z.string().trim().toLowerCase().pipe(z.email({ error: 'Enter a valid email address' }))
          : c.nullable
            ? z.string()
            : z.string().min(1, { error: `${c.name} can't be empty` });
      break;
    case 'uuid':
      schema = z.uuid({ error: `${c.name} must be a UUID` });
      break;
    case 'integer':
      schema = z.int32({ error: `${c.name} must be a whole number` });
      break;
    case 'number':
      schema = z.number({ error: `${c.name} must be a number` });
      break;
    case 'boolean':
      schema = z.boolean({ error: `${c.name} must be true or false` });
      break;
    case 'timestamp':
      schema = z.iso
        .datetime({ offset: true, error: `${c.name} must be a date like 2026-01-31T12:00:00Z` })
        .transform((s) => new Date(s));
      break;
    case 'enum':
      schema = z.enum(c.enumValues as [string, ...string[]], {
        error: `${c.name} must be one of ${c.enumValues!.join(', ')}`,
      });
      break;
    default:
      schema = z.never({ error: `${c.name} can't be edited here` });
  }
  return c.nullable ? schema.nullable() : schema;
}
