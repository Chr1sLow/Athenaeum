import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useEffectEvent, useRef } from 'react';
import { Button } from '../../../components/Button/Button.tsx';
import { CloseButton } from '../../../components/CloseButton/CloseButton.tsx';
import styles from './ImageViewer.module.scss';

export interface ImageViewerProps {
  /** Every picture's URL; `index` picks the one shown. */
  srcs: string[];
  index: number;
  onIndexChange(index: number): void;
  onClose(): void;
}

/** One picture as large as the screen allows, over a dark backdrop. ← → step, Escape closes. */
export function ImageViewer({ srcs, index, onIndexChange, onClose }: ImageViewerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const label = `Image ${index + 1} of ${srcs.length}`;
  const hasPrev = index > 0;
  const hasNext = index < srcs.length - 1;

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1);
    else if (e.key === 'ArrowRight' && hasNext) onIndexChange(index + 1);
    else return;
    e.preventDefault();
  });

  useEffect(() => {
    dialogRef.current?.focus();
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', listener);
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={styles.viewer}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.close}>
        <CloseButton onClick={onClose} />
      </div>
      <img key={srcs[index]} src={srcs[index]} alt={label} className={styles.image} />
      <div className={styles.controls}>
        <Button
          variant="icon"
          aria-label="Previous image"
          icon={<ChevronLeft size={22} />}
          disabled={!hasPrev}
          onClick={() => onIndexChange(index - 1)}
        />
        <span className={styles.counter} aria-hidden>
          {index + 1} / {srcs.length}
        </span>
        <Button
          variant="icon"
          aria-label="Next image"
          icon={<ChevronRight size={22} />}
          disabled={!hasNext}
          onClick={() => onIndexChange(index + 1)}
        />
      </div>
    </div>
  );
}
