import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router';
import styles from './BackToShelfLink.module.scss';

/** The small "‹ Shelf" link above a collection's title. */
export function BackToShelfLink() {
  return (
    <Link to="/" className={styles.link}>
      <ChevronLeft size={16} aria-hidden /> Shelf
    </Link>
  );
}
