import type { AdminRow, AdminTable } from '@athenaeum/shared';
import { rowId, rowLabel } from '../adminCells.ts';
import { type AdminView, viewParams } from '../adminView.ts';
import { PaneLink } from '../PaneLink/PaneLink.tsx';
import styles from './RowList.module.scss';

export interface RowListProps {
  table: AdminTable;
  rows: AdminRow[];
  view: AdminView;
  /** Id of the open row. */
  selected?: string;
}

/** The middle column's list: each row's id, with its first text column (an email, a title) under it. */
export function RowList({ table, rows, view, selected }: RowListProps) {
  return (
    <ul className={styles.list} aria-label={`${table.name} rows`}>
      {rows.map((row) => {
        const id = rowId(table, row);
        return (
          <li key={id}>
            <PaneLink
              to={`/admin?${viewParams(table.name, view, id)}`}
              current={id === selected || undefined}
              detail={rowLabel(table, row)}
              detailPosition="below"
            >
              {id}
            </PaneLink>
          </li>
        );
      })}
    </ul>
  );
}
