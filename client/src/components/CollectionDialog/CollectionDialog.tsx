import { COLLECTION_NAME_MAX, type BookSummary } from '@athenaeum/shared';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '../Button/Button.tsx';
import { FormError } from '../FormError/FormError.tsx';
import { Modal } from '../Modal/Modal.tsx';
import { TextField } from '../TextField/TextField.tsx';
import { BookPicker } from './BookPicker/BookPicker.tsx';
import styles from './CollectionDialog.module.scss';

export interface CollectionDialogProps {
  mode: 'create' | 'edit';
  /** Every book on the shelf, in shelf order. */
  books: BookSummary[];
  initialName?: string;
  initialBookIds?: string[];
  saving: boolean;
  /** An error from the server, shown above the form. */
  serverError?: string | null;
  onSave(name: string, bookIds: string[]): void;
  onClose(): void;
}

const LABELS = {
  create: { title: 'New collection', submit: 'Create collection', saving: 'Creating…' },
  edit: { title: 'Edit collection', submit: 'Save', saving: 'Saving…' },
} as const;

/** Name a collection and tick the books that belong in it. Used to create and to edit. */
export function CollectionDialog({
  mode,
  books,
  initialName = '',
  initialBookIds = [],
  saving,
  serverError,
  onSave,
  onClose,
}: CollectionDialogProps) {
  const labels = LABELS[mode];
  const formId = useId();
  const [name, setName] = useState(initialName);
  const [selected, setSelected] = useState(() => new Set(initialBookIds));
  const [localError, setLocalError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setLocalError('Give the collection a name');
    setLocalError(null);
    // Keep shelf order so the request doesn't depend on click order.
    onSave(name.trim(), books.filter((b) => selected.has(b.id)).map((b) => b.id));
  }

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" form={formId} variant="primary" disabled={saving}>
        {saving ? labels.saving : labels.submit}
      </Button>
    </>
  );

  return (
    <Modal title={labels.title} onClose={onClose} footer={footer}>
      <form id={formId} onSubmit={submit} noValidate className={styles.form}>
        <FormError message={localError ?? serverError} />
        <TextField
          label="Name"
          value={name}
          maxLength={COLLECTION_NAME_MAX}
          autoFocus
          autoComplete="off"
          placeholder="e.g. Favorites, Fantasy, To read next"
          onChange={(e) => setName(e.target.value)}
        />
        <BookPicker books={books} selected={selected} onToggle={toggle} />
      </form>
    </Modal>
  );
}
