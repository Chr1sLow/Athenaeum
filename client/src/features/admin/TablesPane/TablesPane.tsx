import type { AdminTable } from '@athenaeum/shared';
import { Database } from 'lucide-react';
import { formatCount } from '../../../lib/format.ts';
import { Pane } from '../Pane/Pane.tsx';
import { PaneLink } from '../PaneLink/PaneLink.tsx';
import styles from './TablesPane.module.scss';

export interface TablesPaneProps {
  tables: AdminTable[];
  current: string;
  hiddenOnPhone: boolean;
}

/** The left column: every table in the database, with its row count. */
export function TablesPane({ tables, current, hiddenOnPhone }: TablesPaneProps) {
  const rows = tables.reduce((sum, t) => sum + t.rowCount, 0);
  return (
    <Pane
      icon={<Database size={20} />}
      title="Database"
      headingLevel={1}
      hiddenOnPhone={hiddenOnPhone}
      toolbar={
        <p className={styles.summary}>
          {formatCount(tables.length)} tables · {formatCount(rows)} rows
        </p>
      }
    >
      <nav aria-label="Tables">
        <ul className={styles.list}>
          {tables.map((t) => (
            <li key={t.name}>
              <PaneLink
                to={`/admin?table=${encodeURIComponent(t.name)}`}
                current={t.name === current ? 'page' : undefined}
                detail={formatCount(t.rowCount)}
              >
                {t.name}
              </PaneLink>
            </li>
          ))}
        </ul>
      </nav>
    </Pane>
  );
}
