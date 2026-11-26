import type { AdminColumn, AdminRow } from '@athenaeum/shared';
import { KeyRound } from 'lucide-react';
import { FieldValue } from '../FieldValue/FieldValue.tsx';
import styles from './FieldList.module.scss';

export interface FieldListProps {
  columns: AdminColumn[];
  row: AdminRow;
}

/** What a column is, for the tooltip on its name: "primary key, uuid, points to users". */
function columnDetails(column: AdminColumn): string {
  return [
    column.primaryKey && 'primary key',
    column.type,
    column.nullable && 'nullable',
    column.references && `points to ${column.references}`,
    !column.editable && 'read-only',
  ]
    .filter(Boolean)
    .join(', ');
}

/** Every column of one row as `name: value` lines. */
export function FieldList({ columns, row }: FieldListProps) {
  return (
    <dl className={styles.list}>
      {columns.map((column) => (
        <div key={column.name} className={styles.field}>
          <dt className={styles.name} title={columnDetails(column)}>
            {column.primaryKey && <KeyRound size={12} aria-hidden className={styles.key} />}
            {column.name}
          </dt>
          <dd className={styles.value}>
            <FieldValue column={column} value={row[column.name] ?? null} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
