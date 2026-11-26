import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { SearchField } from '../../SearchField/SearchField.tsx';
import { SegmentedControl } from '../../SegmentedControl/SegmentedControl.tsx';
import styles from './ChapterListToolbar.module.scss';

export type ChapterFilter = 'all' | 'read' | 'unread';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'read', label: 'Read' },
  { value: 'unread', label: 'Unread' },
] as const;

const ORDER_OPTIONS = [
  {
    value: 'oldest',
    label: 'Oldest first',
    icon: <ArrowUpNarrowWide size={18} />,
  },
  {
    value: 'newest',
    label: 'Newest first',
    icon: <ArrowDownWideNarrow size={18} />,
  },
] as const;

export interface ChapterListToolbarProps {
  query: string;
  onQueryChange(query: string): void;
  filter: ChapterFilter;
  onFilterChange(filter: ChapterFilter): void;
  newestFirst: boolean;
  onNewestFirstChange(newestFirst: boolean): void;
}

/** Search box, All / Read / Unread filter and sort order above the chapter list. */
export function ChapterListToolbar(props: ChapterListToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <SearchField label="Search chapters" placeholder="Search" value={props.query} onChange={props.onQueryChange} />
      </div>
      <SegmentedControl label="Show" options={FILTER_OPTIONS} value={props.filter} onChange={props.onFilterChange} />
      <div className={styles.order}>
        <SegmentedControl
          label="Order"
          options={ORDER_OPTIONS}
          value={props.newestFirst ? 'newest' : 'oldest'}
          onChange={(order) => props.onNewestFirstChange(order === 'newest')}
        />
      </div>
    </div>
  );
}
