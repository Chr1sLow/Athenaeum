import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../components/Button/Button.tsx';
import { formatCount } from '../../../lib/format.ts';
import styles from './Pager.module.scss';

export interface PagerProps {
  /** 1-based. */
  page: number;
  pageCount: number;
  onPage(page: number): void;
}

/** Previous / next page buttons. Hidden when everything fits on one page. */
export function Pager({ page, pageCount, onPage }: PagerProps) {
  if (pageCount <= 1) return null;
  return (
    <nav className={styles.pager} aria-label="Pages">
      <Button
        variant="icon"
        aria-label="Previous page"
        icon={<ChevronLeft size={18} />}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      />
      <span className={styles.label}>
        Page {formatCount(page)} of {formatCount(pageCount)}
      </span>
      <Button
        variant="icon"
        aria-label="Next page"
        icon={<ChevronRight size={18} />}
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      />
    </nav>
  );
}
