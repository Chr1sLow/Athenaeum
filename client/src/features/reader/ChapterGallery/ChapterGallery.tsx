import type { GalleryImage } from '@athenaeum/shared';
import { useState } from 'react';
import { Modal } from '../../../components/Modal/Modal.tsx';
import { GalleryButton } from '../GalleryButton/GalleryButton.tsx';
import { GalleryGrid } from '../GalleryGrid/GalleryGrid.tsx';
import { ImageViewer } from '../ImageViewer/ImageViewer.tsx';

export interface ChapterGalleryProps {
  bookId: string;
  images: GalleryImage[];
}

/**
 * A chapter's illustrations: a button in the corner opens a grid of them, and picking one shows
 * it large. Escape steps back from the large view to the grid, then closes the grid.
 */
export function ChapterGallery({ bookId, images }: ChapterGalleryProps) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  if (!images.length) return null;

  const srcs = images.map((img) => `/api/books/${bookId}/images/${img.imageId}`);
  return (
    <>
      <GalleryButton count={images.length} onClick={() => setOpen(true)} />
      {open && viewing === null && (
        <Modal title="Chapter images" size="wide" onClose={() => setOpen(false)}>
          <GalleryGrid images={images} srcs={srcs} onOpen={setViewing} />
        </Modal>
      )}
      {open && viewing !== null && (
        <ImageViewer srcs={srcs} index={viewing} onIndexChange={setViewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}
