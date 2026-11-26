import { Images } from 'lucide-react';
import styles from './GalleryButton.module.scss';

export interface GalleryButtonProps {
  count: number;
  onClick(): void;
}

/** The round button pinned to the bottom-right corner of the reader, with the number of pictures. */
export function GalleryButton({ count, onClick }: GalleryButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={`Chapter images (${count})`}
      title="Chapter images"
      aria-haspopup="dialog"
      onClick={onClick}
    >
      <Images size={20} aria-hidden />
      <span className={styles.count} aria-hidden>
        {count}
      </span>
    </button>
  );
}
