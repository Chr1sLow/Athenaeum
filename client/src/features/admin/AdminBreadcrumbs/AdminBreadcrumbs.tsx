import { ChevronRight, House } from 'lucide-react';
import { Link } from 'react-router';
import styles from './AdminBreadcrumbs.module.scss';

export interface AdminBreadcrumbsProps {
  table: string;
  /** Id of the open row. */
  row?: string;
}

/** "⌂ › books › 6f1c…" above the console. On phones, it's the way back from a row to its table. */
export function AdminBreadcrumbs({ table, row }: AdminBreadcrumbsProps) {
  const separator = <ChevronRight size={16} aria-hidden className={styles.separator} />;
  return (
    <nav aria-label="Breadcrumb">
      <ol className={styles.list}>
        <li className={styles.crumb}>
          <Link to="/admin" className={styles.home} aria-label="All tables" title="All tables">
            <House size={20} aria-hidden />
          </Link>
        </li>
        <li className={styles.crumb}>
          {separator}
          {row ? (
            <Link to={`/admin?table=${encodeURIComponent(table)}`} className={styles.link}>
              {table}
            </Link>
          ) : (
            <span className={styles.current} aria-current="page">
              {table}
            </span>
          )}
        </li>
        {row && (
          <li className={styles.crumb}>
            {separator}
            <span className={styles.current} aria-current="page" title={row}>
              {row}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}
