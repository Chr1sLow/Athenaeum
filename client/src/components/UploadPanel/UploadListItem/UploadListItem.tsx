import { CircleAlert, CircleCheck } from 'lucide-react';
import { ProgressBar } from '../../ProgressBar/ProgressBar.tsx';
import type { UploadItem } from '../../UploadProvider/UploadProvider.tsx';
import styles from './UploadListItem.module.scss';

export interface UploadListItemProps {
  item: UploadItem;
}

/** One file in the upload panel: its name, then a progress bar, "Processing…", success or the error. */
export function UploadListItem({ item }: UploadListItemProps) {
  return (
    <li className={styles.item}>
      <span className={styles.name}>{item.name}</span>
      {item.status === 'uploading' && <ProgressBar label={item.name} value={item.progress} />}
      {item.status === 'processing' && <span className={styles.note}>Processing…</span>}
      {item.status === 'done' && (
        <span className={`${styles.note} ${styles.done}`}>
          <CircleCheck size={14} aria-hidden /> Added to your shelf
        </span>
      )}
      {item.status === 'error' && (
        <span className={`${styles.note} ${styles.failed}`}>
          <CircleAlert size={14} aria-hidden /> {item.error}
        </span>
      )}
    </li>
  );
}
