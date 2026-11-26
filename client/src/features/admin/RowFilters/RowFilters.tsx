import type { AdminTable } from '@athenaeum/shared';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { SearchField } from '../../../components/SearchField/SearchField.tsx';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl.tsx';
import { type AdminView, withSort } from '../adminView.ts';
import { SelectField } from '../SelectField/SelectField.tsx';
import styles from './RowFilters.module.scss';

export interface RowFiltersProps {
  table: AdminTable;
  view: AdminView;
  onViewChange(view: AdminView): void;
}

const SEARCH_DELAY_MS = 250;
const DEFAULT_ORDER = '';

const DIRECTIONS = [
  {
    value: 'asc',
    label: 'Ascending',
    icon: <ArrowUpNarrowWide size={16} />,
  },
  {
    value: 'desc',
    label: 'Descending',
    icon: <ArrowDownWideNarrow size={16} />,
  },
] as const;

/** Search and sort for the row list. The search runs once you pause typing. */
export function RowFilters({ table, view, onViewChange }: RowFiltersProps) {
  const query = view.q ?? '';
  const [draft, setDraft] = useState(query);
  // Always calls the latest onViewChange, without restarting the typing timer when it changes.
  const search = useEffectEvent((q: string) => onViewChange({ ...view, q, page: undefined }));

  useEffect(() => {
    const next = draft.trim();
    if (next === query) return;
    const timer = setTimeout(() => search(next), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, query]);

  const sortable = table.columns.filter((c) => c.type !== 'binary' && c.type !== 'json');
  const sortOptions = [
    { value: DEFAULT_ORDER, label: 'Default order' },
    ...sortable.map((c) => ({ value: c.name, label: c.name })),
  ];

  return (
    <div className={styles.filters}>
      <SearchField label={`Search ${table.name}`} placeholder="Search text and ids" value={draft} onChange={setDraft} />
      <div className={styles.sort}>
        <SelectField
          label="Sort by"
          value={view.sort ?? DEFAULT_ORDER}
          options={sortOptions}
          onChange={(column) => onViewChange(withSort(view, column || undefined, view.dir))}
        />
        {view.sort && (
          <SegmentedControl
            label="Direction"
            options={DIRECTIONS}
            value={view.dir ?? 'asc'}
            onChange={(dir) => onViewChange(withSort(view, view.sort, dir))}
          />
        )}
      </div>
    </div>
  );
}
