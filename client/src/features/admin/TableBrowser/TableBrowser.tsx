import type { AdminRow, AdminTable } from '@athenaeum/shared';
import { type ReactNode, useState } from 'react';
import { useAdminRows, useDeleteRow, useResetPassword } from '../../../api/admin.ts';
import { useMe } from '../../../api/auth.ts';
import { EmptyState } from '../../../components/EmptyState/EmptyState.tsx';
import { PageSkeleton } from '../../../components/PageSkeleton/PageSkeleton.tsx';
import { rowId, rowKey } from '../adminCells.ts';
import type { AdminView } from '../adminView.ts';
import { EditRowDialog } from '../EditRowDialog/EditRowDialog.tsx';
import { Pager } from '../Pager/Pager.tsx';
import { PasswordResetDialog } from '../PasswordResetDialog/PasswordResetDialog.tsx';
import { RowList } from '../RowList/RowList.tsx';
import { type RowActions, RowPane } from '../RowPane/RowPane.tsx';
import { RowsPane } from '../RowsPane/RowsPane.tsx';

export interface TableBrowserProps {
  table: AdminTable;
  view: AdminView;
  /** Id of the open row (?row=). */
  selected?: string;
  /** Which pane a phone shows: the row list, or the open row. */
  phoneShows: 'rows' | 'row' | 'tables';
  /** Changes the search, sort or page. This closes the open row. */
  onViewChange(view: AdminView): void;
}

/** The middle and right columns: one table's rows, and the fields of the row you opened. */
export function TableBrowser({ table, view, selected, phoneShows, onViewChange }: TableBrowserProps) {
  const rows = useAdminRows(table.name, view);
  const me = useMe();
  const remove = useDeleteRow(table.name);
  const reset = useResetPassword();
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const isUsers = table.name === 'users';
  const actions: RowActions = {
    onEdit: setEditing,
    onDelete(row) {
      const question = `Delete this row from ${table.name}? Anything in other tables that belongs to it is deleted too.`;
      if (!window.confirm(question)) return;
      remove.mutate(rowKey(table, row), {
        onSuccess: () => onViewChange(view),
        onError: (err) => window.alert(`Couldn't delete the row. ${err.message}`),
      });
    },
    onResetPassword: isUsers
      ? (row) => {
          const email = String(row.email);
          if (!window.confirm(`Give ${email} a new temporary password? They'll be signed out everywhere.`)) return;
          reset.mutate(String(row.id), {
            onSuccess: ({ password }) => setIssued({ email, password }),
            onError: (err) => window.alert(`Couldn't reset the password. ${err.message}`),
          });
        }
      : undefined,
    // Your own account can't be deleted here, and resetting your own password would sign you
    // out before you could read the new one.
    isLocked: (row) => isUsers && row.id === me.data?.id,
  };

  let list: ReactNode;
  if (rows.isPending) {
    list = <PageSkeleton label={`Loading ${table.name}`} height="40vh" />;
  } else if (rows.isError) {
    list = <EmptyState message={`Couldn't load ${table.name}. ${rows.error.message}`} />;
  } else if (!rows.data.rows.length) {
    list = <EmptyState message={view.q ? `No rows match “${view.q}”.` : 'This table is empty.'} />;
  } else {
    list = <RowList table={table} rows={rows.data.rows} view={view} selected={selected} />;
  }

  const pageCount = rows.data ? Math.ceil(rows.data.total / rows.data.pageSize) : 0;
  const openRow = selected ? rows.data?.rows.find((row) => rowId(table, row) === selected) : undefined;

  return (
    <>
      <RowsPane
        table={table}
        view={view}
        onViewChange={onViewChange}
        total={rows.data?.total}
        hiddenOnPhone={phoneShows !== 'rows'}
        pager={
          rows.data &&
          pageCount > 1 && <Pager page={rows.data.page} pageCount={pageCount} onPage={(page) => onViewChange({ ...view, page })} />
        }
      >
        {list}
      </RowsPane>
      <RowPane table={table} row={openRow} actions={actions} hiddenOnPhone={phoneShows !== 'row'} />
      {editing && <EditRowDialog table={table} row={editing} onClose={() => setEditing(null)} />}
      {issued && <PasswordResetDialog {...issued} onClose={() => setIssued(null)} />}
    </>
  );
}
