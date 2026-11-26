import type { CollectionDetail } from '@athenaeum/shared';
import { Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDeleteCollection } from '../../../api/collections.ts';
import { Button } from '../../../components/Button/Button.tsx';

export interface CollectionActionsProps {
  collection: Pick<CollectionDetail, 'id' | 'name'>;
  onEdit(): void;
}

/** The Edit and Delete buttons beside a collection's title. Delete asks first, then returns to the shelf. */
export function CollectionActions({ collection, onEdit }: CollectionActionsProps) {
  const remove = useDeleteCollection(collection.id);
  const navigate = useNavigate();

  const confirmDelete = () => {
    if (!window.confirm(`Delete the collection “${collection.name}”? The books stay on your shelf.`)) return;
    remove.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) });
  };

  return (
    <>
      <Button icon={<Pencil size={16} />} onClick={onEdit}>
        Edit
      </Button>
      <Button variant="danger" icon={<Trash2 size={16} />} onClick={confirmDelete} disabled={remove.isPending}>
        Delete
      </Button>
    </>
  );
}
