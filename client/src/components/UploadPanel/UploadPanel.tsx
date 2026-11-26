import type { UploadItem } from '../UploadProvider/UploadProvider.tsx';
import { CloseButton } from '../CloseButton/CloseButton.tsx';
import { UploadListItem } from './UploadListItem/UploadListItem.tsx';
import styles from './UploadPanel.module.scss';

export interface UploadPanelProps {
  items: UploadItem[];
  /** Dismiss finished and failed uploads. */
  onClear(): void;
}

/** The pop-up in the bottom-right corner that follows each upload. */
export function UploadPanel({ items, onClear }: UploadPanelProps) {
  if (!items.length) return null;
  const busy = items.some((it) => it.status === 'uploading' || it.status === 'processing');

  return (
    <section className={styles.panel} aria-label="Uploads" aria-live="polite">
      <header className={styles.head}>
        <h2>{busy ? 'Adding books…' : 'Uploads'}</h2>
        {!busy && <CloseButton size="small" label="Dismiss uploads" onClick={onClear} />}
      </header>
      <ul className={styles.list}>
        {items.map((item) => (
          <UploadListItem key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
