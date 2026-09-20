import Image from 'next/image';
import { Button } from '@/components/ui/Button/Button';
import type { ProductDetail } from '@/lib/catalog/queries';
import { formatProductDate } from '@/utils/formatProduct';
import styles from './ProductSetSection.module.scss';
export function ProductSetSection({
  set,
}: {
  set: NonNullable<ProductDetail['tcgSet']>;
}) {
  return (
    <section className={styles.set}>
      <div>
        <p className={styles.eyebrow}>Dans l’extension</p>
        <h2>{set.name}</h2>
        {set.series && <p>{set.series}</p>}
        {set.releaseDate && (
          <p>Sortie le {formatProductDate(set.releaseDate)}</p>
        )}
      </div>
      {set.logoUrl && (
        <Image
          src={set.logoUrl}
          alt={`Logo ${set.name}`}
          width={160}
          height={100}
        />
      )}
      <Button href={`/extensions/${set.slug}`} variant="gold">
        Découvrir l’extension
      </Button>
    </section>
  );
}
