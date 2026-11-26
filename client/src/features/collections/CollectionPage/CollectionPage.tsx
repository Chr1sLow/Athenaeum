import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { useCollection } from '../../../api/collections.ts';
import { Button, ButtonLink } from '../../../components/Button/Button.tsx';
import { EmptyState } from '../../../components/EmptyState/EmptyState.tsx';
import { PageHeading } from '../../../components/PageHeading/PageHeading.tsx';
import { PageSkeleton } from '../../../components/PageSkeleton/PageSkeleton.tsx';
import { bookCountLabel } from '../../../lib/format.ts';
import { useDocumentTitle } from '../../../lib/useDocumentTitle.ts';
import { BackToShelfLink } from '../BackToShelfLink/BackToShelfLink.tsx';
import { CollectionActions } from '../CollectionActions/CollectionActions.tsx';
import { CollectionBookTabs } from '../CollectionBookTabs/CollectionBookTabs.tsx';
import { type CollectionSort, sortCollectionBooks } from '../collectionSort.ts';
import { EditCollectionDialog } from '../EditCollectionDialog/EditCollectionDialog.tsx';
import styles from './CollectionPage.module.scss';

/** /collections/:id */
export function CollectionPage() {
  const { id = '' } = useParams();
  const collection = useCollection(id);
  const [sort, setSort] = useState<CollectionSort>('added');
  const [editing, setEditing] = useState(false);
  useDocumentTitle(collection.data?.name);

  if (collection.isPending) return <PageSkeleton label="Loading collection" height="50vh" />;
  if (collection.isError || !collection.data) {
    return <EmptyState message="This collection doesn't exist." action={<ButtonLink to="/">Back to shelf</ButtonLink>} />;
  }

  const { books } = collection.data;
  const startEditing = () => setEditing(true);

  return (
    <div className={styles.page}>
      <BackToShelfLink />
      <PageHeading
        title={collection.data.name}
        subtitle={bookCountLabel(books.length)}
        actions={<CollectionActions collection={collection.data} onEdit={startEditing} />}
      />

      {books.length === 0 ? (
        <EmptyState
          variant="outlined"
          message="No books in this collection yet."
          action={
            <Button variant="primary" icon={<Plus size={18} />} onClick={startEditing}>
              Add books
            </Button>
          }
        />
      ) : (
        <CollectionBookTabs books={sortCollectionBooks(books, sort)} sort={sort} onSortChange={setSort} />
      )}

      {editing && <EditCollectionDialog collection={collection.data} onClose={() => setEditing(false)} />}
    </div>
  );
}
