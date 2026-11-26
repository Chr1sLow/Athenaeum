import type { AdminCell, AdminColumn } from '@athenaeum/shared';
import { Link } from 'react-router';
import { formatBytes } from '../../../lib/format.ts';
import { formatTimestamp } from '../adminCells.ts';
import { viewParams } from '../adminView.ts';
import styles from './FieldValue.module.scss';

export interface FieldValueProps {
  column: AdminColumn;
  value: AdminCell;
}

/**
 * One value, written the way the Firestore console writes it: strings in quotes, numbers,
 * booleans and null bare. An id that points to another table links to that row.
 */
export function FieldValue({ column, value }: FieldValueProps) {
  if (value === null) return <span className={styles.null}>null</span>;

  if (column.references && typeof value === 'string') {
    return (
      <Link
        to={`/admin?${viewParams(column.references, { q: value }, value)}`}
        className={styles.link}
        aria-label={`Show ${column.references} row ${value}`}
      >
        "{value}"
      </Link>
    );
  }

  switch (column.type) {
    case 'binary':
      return <span className={styles.muted}>{formatBytes(Number(value))}</span>;
    case 'json':
      return <code className={styles.json}>{String(value)}</code>;
    case 'timestamp':
      return <span>{formatTimestamp(String(value))}</span>;
    case 'integer':
    case 'number':
    case 'boolean':
      return <span className={styles.bare}>{String(value)}</span>;
    default:
      return <span>"{String(value)}"</span>;
  }
}
