import { useNavigate } from 'react-router';
import { useBooks } from '../../../api/books.ts';
import { useCreateCollection } from '../../../api/collections.ts';
import { CollectionDialog } from '../../CollectionDialog/CollectionDialog.tsx';

export interface CreateCollectionDialogProps {
  onClose(): void;
}

/** "New collection": name it, pick books from the shelf, then open the new collection. */
export function CreateCollectionDialog({ onClose }: CreateCollectionDialogProps) {
  const shelf = useBooks();
  const create = useCreateCollection();
  const navigate = useNavigate();

  return (
    <CollectionDialog
      mode="create"
      books={shelf.data ?? []}
      saving={create.isPending}
      serverError={create.error?.message}
      onClose={() => {
        create.reset();
        onClose();
      }}
      onSave={(name, bookIds) =>
        create.mutate({ name, bookIds }, { onSuccess: (created) => navigate(`/collections/${created.id}`) })
      }
    />
  );
}
