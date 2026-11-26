import { type ReactNode, useEffect, useId } from 'react';
import { CloseButton } from '../CloseButton/CloseButton.tsx';
import styles from './Modal.module.scss';

interface ModalProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** Buttons along the bottom edge. */
  footer?: ReactNode;
  /** `wide` for content laid out in a grid, such as a gallery of pictures. */
  size?: 'medium' | 'wide';
}

/** A centered dialog over a dimmed page. Escape or a click outside closes it. */
export function Modal({ title, onClose, children, footer, size = 'medium' }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={size === 'wide' ? `${styles.dialog} ${styles.wide}` : styles.dialog}>
        <header className={styles.head}>
          <h2 id={titleId}>{title}</h2>
          <CloseButton onClick={onClose} />
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.foot}>{footer}</footer>}
      </div>
    </div>
  );
}
