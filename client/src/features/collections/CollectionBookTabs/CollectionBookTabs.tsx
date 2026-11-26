import type { CollectionBook } from '@athenaeum/shared';
import { useSearchParams } from 'react-router';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl.tsx';
import { Tabs } from '../../../components/Tabs/Tabs.tsx';
import { CollectionBookPanel } from '../CollectionBookPanel/CollectionBookPanel.tsx';
import { COLLECTION_SORT_OPTIONS, type CollectionSort } from '../collectionSort.ts';

export interface CollectionBookTabsProps {
  /** Already sorted. */
  books: CollectionBook[];
  sort: CollectionSort;
  onSortChange(sort: CollectionSort): void;
}

/**
 * One tab per book, with the sort control beside the strip; the selected tab shows that book's
 * details. The selection lives in the address (?book=…) so refresh and back keep it.
 */
export function CollectionBookTabs({ books, sort, onSortChange }: CollectionBookTabsProps) {
  const [params, setParams] = useSearchParams();
  const selected = books.find((b) => b.id === params.get('book')) ?? books[0]!;
  const tabs = books.map((b) => ({ id: b.id, label: b.title }));

  return (
    <Tabs
      label="Books in this collection"
      items={tabs}
      selectedId={selected.id}
      onSelect={(bookId) => setParams({ book: bookId }, { replace: true })}
      aside={
        <SegmentedControl
          label="Sort by"
          showLabel
          options={COLLECTION_SORT_OPTIONS}
          value={sort}
          onChange={onSortChange}
        />
      }
    >
      <CollectionBookPanel bookId={selected.id} />
    </Tabs>
  );
}
