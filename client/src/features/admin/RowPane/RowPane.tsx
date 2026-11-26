import type { AdminRow, AdminTable } from '@athenaeum/shared';
import { FileText, KeyRound, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../../components/Button/Button.tsx';
import { type MenuItem, Menu } from '../../../components/Menu/Menu.tsx';
import { rowId } from '../adminCells.ts';
import { FieldList } from '../FieldList/FieldList.tsx';
import { Pane } from '../Pane/Pane.tsx';
import styles from './RowPane.module.scss';

export interface RowActions {
  onEdit(row: AdminRow): void;
  onDelete(row: AdminRow): void;
  /** Only on the users table. */
  onResetPassword?(row: AdminRow): void;
  /** Rows that can't be deleted or have their password reset here (your own account). */
  isLocked(row: AdminRow): boolean;
}

export interface RowPaneProps {
  table: AdminTable;
  /** The open row; without one the pane asks you to pick one. */
  row?: AdminRow;
  actions: RowActions;
  hiddenOnPhone: boolean;
}

/** The right column: every field of the open row, with edit, reset-password and delete actions. */
export function RowPane({ table, row, actions, hiddenOnPhone }: RowPaneProps) {
  if (!row) {
    return (
      <Pane icon={<FileText size={20} />} title="No row open" hiddenOnPhone={hiddenOnPhone}>
        <p className={styles.hint}>Choose a row to see its fields.</p>
      </Pane>
    );
  }

  const id = rowId(table, row);
  const locked = actions.isLocked(row);
  const { onResetPassword } = actions;
  const items: MenuItem[] = [];
  if (onResetPassword) {
    items.push({
      label: 'Reset password',
      icon: <KeyRound size={16} />,
      disabled: locked,
      onSelect: () => onResetPassword(row),
    });
  }
  items.push({
    label: 'Delete row',
    icon: <Trash2 size={16} />,
    danger: true,
    disabled: locked,
    onSelect: () => actions.onDelete(row),
  });

  return (
    <Pane
      icon={<FileText size={20} />}
      title={id}
      label={`Row ${id}`}
      hiddenOnPhone={hiddenOnPhone}
      actions={<Menu label="Row actions" icon={<MoreVertical size={18} />} items={items} />}
      toolbar={
        <Button variant="text" icon={<Pencil size={16} />} onClick={() => actions.onEdit(row)}>
          Edit row
        </Button>
      }
    >
      <FieldList columns={table.columns} row={row} />
      {locked && <p className={styles.hint}>This is your own account, so it can't be deleted or reset from here.</p>}
    </Pane>
  );
}
