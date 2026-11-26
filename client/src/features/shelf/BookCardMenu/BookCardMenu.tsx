import type { BookSummary } from '@athenaeum/shared';
import { Ellipsis, Trash2, Pin, PinOff } from 'lucide-react';
import { useDeleteBook, usePinBook } from '../../../api/books.ts';
import { type MenuItem, Menu } from '../../../components/Menu/Menu.tsx';

export interface BookCardMenuProps {
  book: Pick<BookSummary, 'id' | 'title' | 'pinned'>;
}

/** The "…" on a shelf card's cover: Pin/Unpin (the Pinned section above the collections), and Delete, which asks first. */
export function BookCardMenu({ book }: BookCardMenuProps) {
  const remove = useDeleteBook(book.id);
  const pin = usePinBook(book.id);

  const confirmDelete = () => {
    if (!window.confirm(`Delete “${book.title}” from your shelf? Its reading progress will be lost too.`)) return;
    remove.mutate(undefined, {
      onError: (err) => window.alert(`Couldn’t delete “${book.title}”. ${err.message}`),
    });
  };

  const handlePin = () => {
    pin.mutate({ pinned: !book.pinned });
  };

  const items: MenuItem[] = [
    {
      label: book.pinned ? 'Unpin' : 'Pin',
      icon: book.pinned ? <PinOff size={16} /> : <Pin size={16} />,
      onSelect: handlePin,
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
