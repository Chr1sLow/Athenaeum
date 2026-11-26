import type { CollectionSummary } from '@athenaeum/shared';
import { Link } from 'react-router';
import { bookCountLabel } from '../../../lib/format.ts';
import { CollectionCoverMosaic } from '../CollectionCoverMosaic/CollectionCoverMosaic.tsx';
import styles from './CollectionCard.module.scss';

export interface CollectionCardProps {
  collection: CollectionSummary;
}

/** A collection on the shelf: cover mosaic, name and book count, linking to the collection. */
export function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <Link to={`/collections/${collection.id}`} className={styles.card}>
      <div className={styles.cover}>
        <CollectionCoverMosaic books={collection.previewBooks} />
      </div>
      <h3 className={styles.name}>{collection.name}</h3>
      <p className={styles.count}>{bookCountLabel(collection.bookCount)}</p>
    </Link>
  );
}
