import { House, Info, List, Maximize, Minimize } from 'lucide-react';
import { Link } from 'react-router';
import { useFullscreen } from '../../../lib/useFullscreen.ts';
import styles from './ReaderToolbar.module.scss';

export interface ReaderToolbarProps {
  bookId: string;
  /** False until the book has loaded. */
  canOpenChapters: boolean;
  onOpenChapters(): void;
}

/** atsu's vertical icon rail in the top-right corner: chapters, full screen, book details, home. */
export function ReaderToolbar({ bookId, canOpenChapters, onOpenChapters }: ReaderToolbarProps) {
  const { fullscreen, toggleFullscreen } = useFullscreen();

  return (
    <nav className={styles.toolbar} aria-label="Reader">
      <button type="button" className={styles.item} onClick={onOpenChapters} aria-label="Chapters" disabled={!canOpenChapters}>
        <List size={18} />
      </button>
      <button type="button" className={styles.item} onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
        {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
      <Link to={`/book/${bookId}`} className={styles.item} aria-label="Book details" title="Book details">
        <Info size={18} />
      </Link>
      <Link to="/" className={styles.item} aria-label="Home" title="Home">
        <House size={18} />
      </Link>
    </nav>
  );
}
