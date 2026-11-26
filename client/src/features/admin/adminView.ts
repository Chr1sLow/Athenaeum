// The table browser's state lives in the URL (?table=books&q=dune&sort=title&dir=asc&page=2&row=<id>),
// so a view can be reloaded, shared, or linked to from a foreign key field.
import type { AdminRowsQuery } from '../../api/admin.ts';

export type AdminView = AdminRowsQuery;

export function readView(params: URLSearchParams): AdminView {
  const page = Number(params.get('page'));
  const dir = params.get('dir');
  return {
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    q: params.get('q') ?? undefined,
    sort: params.get('sort') ?? undefined,
    dir: dir === 'asc' || dir === 'desc' ? dir : undefined,
  };
}

/** The id of the row open in the right-hand pane, if any. */
export const readRow = (params: URLSearchParams) => params.get('row') ?? undefined;

/** The URL query for a view, with `row` open. Leaving `row` out closes the open row. */
export function viewParams(table: string, view: AdminView, row?: string): URLSearchParams {
  const params = new URLSearchParams({ table });
  if (view.q) params.set('q', view.q);
  if (view.sort) params.set('sort', view.sort);
  if (view.sort && view.dir) params.set('dir', view.dir);
  if (view.page && view.page > 1) params.set('page', String(view.page));
  if (row) params.set('row', row);
  return params;
}

/** The same view sorted by `column` (or in the default order without one). A new sort starts on page 1. */
export function withSort(view: AdminView, column: string | undefined, dir: 'asc' | 'desc' = 'asc'): AdminView {
  return { ...view, sort: column, dir: column ? dir : undefined, page: undefined };
}
