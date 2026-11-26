import type { GalleryImage } from '@athenaeum/shared';
import styles from './GalleryGrid.module.scss';

export interface GalleryGridProps {
  images: GalleryImage[];
  /** Image URLs, in the same order. */
  srcs: string[];
  onOpen(index: number): void;
}

/** Small rounded thumbnails of a chapter's pictures; each opens the picture large. */
export function GalleryGrid({ images, srcs, onOpen }: GalleryGridProps) {
  return (
    <ul className={styles.grid}>
      {images.map((img, i) => (
        <li key={img.imageId}>
          <button
            type="button"
            className={styles.thumb}
            aria-label={`View image ${i + 1} of ${images.length}`}
            onClick={() => onOpen(i)}
          >
            <img src={srcs[i]} alt="" width={img.width} height={img.height} loading="lazy" />
          </button>
        </li>
      ))}
    </ul>
  );
}
