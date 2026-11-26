import type { AdminRow, AdminTable } from '@athenaeum/shared';
import { type FormEvent, useId, useState } from 'react';
import { useUpdateRow } from '../../../api/admin.ts';
import { Button } from '../../../components/Button/Button.tsx';
import { FormError } from '../../../components/FormError/FormError.tsx';
import { Modal } from '../../../components/Modal/Modal.tsx';
import { type FormValue, changedValues, rowKey, toFormValue } from '../adminCells.ts';
import { RowField } from '../RowField/RowField.tsx';
import styles from './EditRowDialog.module.scss';

export interface EditRowDialogProps {
  table: AdminTable;
  row: AdminRow;
  onClose(): void;
}

/** A form with one field per column. Saving sends only what changed. */
export function EditRowDialog({ table, row, onClose }: EditRowDialogProps) {
  const update = useUpdateRow(table.name);
  const formId = useId();
  const [form, setForm] = useState<Record<string, FormValue>>(() =>
    Object.fromEntries(table.columns.map((c) => [c.name, toFormValue(c, row[c.name] ?? null)])),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const values = changedValues(table, row, form);
    if (!Object.keys(values).length) return onClose();
    update.mutate({ key: rowKey(table, row), values }, { onSuccess: onClose });
  };

  return (
    <Modal
      title={`Edit ${table.name} row`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form={formId} disabled={update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        <FormError message={update.error?.message} />
        {table.columns.map((column) => (
          <RowField
            key={column.name}
            column={column}
            value={form[column.name] ?? ''}
            savedValue={row[column.name] ?? null}
            onChange={(value) => setForm((f) => ({ ...f, [column.name]: value }))}
          />
        ))}
      </form>
    </Modal>
  );
}
