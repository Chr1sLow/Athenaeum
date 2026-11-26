import { Upload } from 'lucide-react';
import styles from './DropOverlay.module.scss';

/** The dashed full-screen hint shown while files are dragged over the shelf. */
export function DropOverlay() {
  return (
    <div className={styles.overlay} aria-hidden>
      <Upload size={36} />
      <span>Drop to add to your shelf</span>
    </div>
  );
}
