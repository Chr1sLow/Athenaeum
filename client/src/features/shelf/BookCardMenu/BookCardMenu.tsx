import type { BookSummary } from '@athenaeum/shared';
import { Ellipsis, Trash2, Pin } from 'lucide-react';
import { useDeleteBook, usePinBook } from '../../../api/books.ts';
import { type MenuItem, Menu } from '../../../components/Menu/Menu.tsx';

export interface BookCardMenuProps {
  book: Pick<BookSummary, 'id' | 'title' | 'pinned'>;
}

/** The "…" on a shelf card's cover. Its one action, Delete, asks first. */
export function BookCardMenu({ book }: BookCardMenuProps) {
  const remove = useDeleteBook(book.id);
  const pin = usePinBook(book.id);

  const confirmDelete = () => {
    if (!window.confirm(`Delete “${book.title}” from your shelf? Its reading progress will be lost too.`)) return;
    remove.mutate(undefined, {
      onError: (err) => window.alert(`Couldn’t delete “${book.title}”. ${err.message}`),
    });
  };

  const pinBook = () => {
    pin.mutate({ pinned: !book.pinned });
  }

  const items: MenuItem[] = [
    {
      label: 'Pin',
      icon: <Pin size={16} />,
      onSelect: pinBook,
    },
    {
      label: 'Delete',
      icon: <Trash2 size={16} />,
      danger: true,
      disabled: remove.isPending,
      onSelect: confirmDelete,
    },
  ];

  return <Menu label={`Options for ${book.title}`} icon={<Ellipsis size={18} />} look="overlay" items={items} />;
}
