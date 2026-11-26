import type { CollectionDetail, CollectionInput } from '@athenaeum/shared';
import { useBooks } from '../../../api/books.ts';
import { useUpdateCollection } from '../../../api/collections.ts';
import { CollectionDialog } from '../../../components/CollectionDialog/CollectionDialog.tsx';

export interface EditCollectionDialogProps {
  collection: CollectionDetail;
  onClose(): void;
}

/** Only the fields that changed, so an untouched form sends nothing. */
function changesFrom(collection: CollectionDetail, name: string, bookIds: string[]): Partial<CollectionInput> {
  const before = new Set(collection.books.map((b) => b.id));
  const booksChanged = bookIds.length !== before.size || bookIds.some((id) => !before.has(id));
  return {
    ...(name !== collection.name ? { name } : {}),
    ...(booksChanged ? { bookIds } : {}),
  };
}

/** Rename a collection and change its books. */
export function EditCollectionDialog({ collection, onClose }: EditCollectionDialogProps) {
  const shelf = useBooks();
  const update = useUpdateCollection(collection.id);

  const close = () => {
    update.reset();
    onClose();
  };

  return (
    <CollectionDialog
      mode="edit"
      books={shelf.data ?? []}
      initialName={collection.name}
      initialBookIds={collection.books.map((b) => b.id)}
      saving={update.isPending}
      serverError={update.error?.message}
      onClose={close}
      onSave={(name, bookIds) => {
        const change = changesFrom(collection, name, bookIds);
        if (!Object.keys(change).length) return onClose();
        update.mutate(change, { onSuccess: onClose });
      }}
    />
  );
}
