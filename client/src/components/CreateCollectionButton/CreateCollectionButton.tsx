import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../Button/Button.tsx';
import { CreateCollectionDialog } from './CreateCollectionDialog/CreateCollectionDialog.tsx';

/** "New collection": opens the dialog to name a collection and pick its books from the shelf. */
export function CreateCollectionButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" icon={<Plus size={18} />} onClick={() => setOpen(true)}>
        New collection
      </Button>
      {open && <CreateCollectionDialog onClose={() => setOpen(false)} />}
    </>
  );
}
