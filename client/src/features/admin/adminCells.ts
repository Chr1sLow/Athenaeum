// Plain helpers for showing and editing database values in the admin dashboard.
import type { AdminCell, AdminColumn, AdminRow, AdminTable } from '@athenaeum/shared';
import { formatBytes } from '../../lib/format.ts';

/** What an edit form holds for one column: checkbox state, or the text in the input. */
export type FormValue = string | boolean;

/** "November 22, 2026 at 2:03:00 PM UTC". UTC, because that is how dates are typed into the edit form. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'long', timeZone: 'UTC' });
}

/** A cell in full, for read-only fields in the edit dialog. */
export function fullCell(column: AdminColumn, value: AdminCell): string {
  if (value === null) return 'NULL';
  return column.type === 'binary' ? formatBytes(Number(value)) : String(value);
}

/** The primary key values that identify a row. */
export function rowKey(table: AdminTable, row: AdminRow): AdminRow {
  return Object.fromEntries(table.primaryKey.map((name) => [name, row[name] ?? null]));
}

/**
 * A row's id as shown in the list and kept in the URL (?row=): its primary key values, joined
 * with "." for tables with a two-column key. Ids are UUIDs, numbers and hex, so "." can't clash.
 */
export const rowId = (table: AdminTable, row: AdminRow) => table.primaryKey.map((name) => String(row[name])).join('.');

/** Something readable to tell rows apart in the list: the first text column that isn't part of the key. */
export function rowLabel(table: AdminTable, row: AdminRow): string | undefined {
  const column = table.columns.find((c) => !c.primaryKey && !c.references && c.type === 'text' && row[c.name] != null);
  return column ? String(row[column.name]) : undefined;
}

export function toFormValue(column: AdminColumn, value: AdminCell): FormValue {
  if (column.type === 'boolean') return value === true;
  return value === null ? '' : String(value);
}

/**
 * The value to send for what was typed. An empty optional field means NULL. Text that isn't a
 * number is sent as-is, so the server explains what's wrong with it.
 */
export function fromFormValue(column: AdminColumn, value: FormValue): AdminCell {
  if (typeof value === 'boolean') return value;
  if (value === '' && column.nullable) return null;
  if ((column.type === 'integer' || column.type === 'number') && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

/** Only the editable columns whose value was changed in the form. */
export function changedValues(table: AdminTable, row: AdminRow, form: Record<string, FormValue>): AdminRow {
  const changed: AdminRow = {};
  for (const column of table.columns) {
    if (!column.editable) continue;
    const value = form[column.name];
    if (value === undefined || value === toFormValue(column, row[column.name] ?? null)) continue;
    changed[column.name] = fromFormValue(column, value);
  }
  return changed;
}
