import type { AdminTable } from '@athenaeum/shared';
import { ListFilter, Rows3 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '../../../components/Button/Button.tsx';
import { formatCount } from '../../../lib/format.ts';
import type { AdminView } from '../adminView.ts';
import { Pane } from '../Pane/Pane.tsx';
import { RowFilters } from '../RowFilters/RowFilters.tsx';
import styles from './RowsPane.module.scss';

export interface RowsPaneProps {
  table: AdminTable;
  view: AdminView;
  onViewChange(view: AdminView): void;
  /** Rows matching the search; unknown while the first page loads. */
  total?: number;
  /** Page buttons, pinned at the bottom. */
  pager?: ReactNode;
  hiddenOnPhone: boolean;
  /** The row list, or a loading / empty state. */
  children: ReactNode;
}

/** The middle column: one table's rows, with a filter panel behind the funnel button. */
export function RowsPane({ table, view, onViewChange, total, pager, hiddenOnPhone, children }: RowsPaneProps) {
  // Open from the start when the URL already filters or sorts, so you can see why rows are missing.
  const [filtering, setFiltering] = useState(Boolean(view.q || view.sort));
  return (
    <Pane
      icon={<Rows3 size={20} />}
      title={table.name}
      hiddenOnPhone={hiddenOnPhone}
      actions={
        <Button
          variant="icon"
          aria-label="Filter and sort"
          title="Filter and sort"
          aria-expanded={filtering}
          icon={<ListFilter size={18} />}
          onClick={() => setFiltering((open) => !open)}
        />
      }
      toolbar={
        <>
          <p className={styles.count} aria-live="polite">
            {total === undefined ? 'Loading rows…' : `${formatCount(total)} ${total === 1 ? 'row' : 'rows'}`}
            {view.q && <span className={styles.matching}> matching “{view.q}”</span>}
          </p>
          {filtering && <RowFilters table={table} view={view} onViewChange={onViewChange} />}
        </>
      }
      footer={pager}
    >
      {children}
    </Pane>
  );
}
