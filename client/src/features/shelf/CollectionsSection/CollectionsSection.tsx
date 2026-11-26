import { useId } from 'react';
import { useCollections } from '../../../api/collections.ts';
import { CardGrid } from '../../../components/CardGrid/CardGrid.tsx';
import { CreateCollectionButton } from '../../../components/CreateCollectionButton/CreateCollectionButton.tsx';
import { PageHeading } from '../../../components/PageHeading/PageHeading.tsx';
import { CollectionCard } from '../CollectionCard/CollectionCard.tsx';
import styles from './CollectionsSection.module.scss';

/** The "Your Collections" row at the top of the shelf. */
export function CollectionsSection() {
  const collections = useCollections();
  const headingId = useId();
  const list = collections.data ?? [];

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <PageHeading level={2} size="section" title="Your Collections" titleId={headingId} actions={<CreateCollectionButton />} />

      {collections.isSuccess && list.length === 0 && (
        <p className={styles.hint}>Group novels into collections, like “Favorites” or “To read next”.</p>
      )}

      {list.length > 0 && (
        <CardGrid>
          {list.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </CardGrid>
      )}
    </section>
  );
}
