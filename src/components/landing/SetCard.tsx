import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatDateFr } from '@/lib/seo/metadata';
import { VIEW_EXTENSION_LABEL } from '@/lib/ux/copy';
import type { SetEntry } from './landingData';
import { plural } from './landingText';
import styles from './Sets.module.scss';

/**
 * One set, the same card everywhere: its status and date, its name, its
 * series, how many products are online and, when its page exists, the way
 * in. `featured`: the next release, in the night of the heroes.
 */
export function SetCard({
  entry,
  featured = false,
}: {
  entry: SetEntry;
  featured?: boolean;
}) {
  const date = entry.releaseDate && (
    <time dateTime={entry.releaseDate.toISOString().slice(0, 10)}>
      {formatDateFr(entry.releaseDate)}
    </time>
  );
  return (
    <article className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <p className={styles.label}>
        {featured ? (
          'Prochaine sortie'
        ) : entry.upcoming ? (
          <>À paraître{date && <> · {date}</>}</>
        ) : date ? (
          <>Sortie le {date}</>
        ) : (
          'Extension'
        )}
      </p>
      {entry.logoUrl && (
        <Image
          className={styles.logo}
          src={entry.logoUrl}
          alt=""
          width={140}
          height={60}
        />
      )}
      <h3>
        {/* The set's own mark, as printed on its cards: decorative here. */}
        {entry.symbolUrl && (
          <Image
            className={styles.symbol}
            src={entry.symbolUrl}
            alt=""
            width={22}
            height={22}
          />
        )}
        {entry.href ? <Link href={entry.href}>{entry.name}</Link> : entry.name}
      </h3>
      {featured && date && <p className={styles.date}>{date}</p>}
      {entry.series && <p className={styles.meta}>{entry.series}</p>}
      <p className={styles.footer}>
        <span>
          {entry.count
            ? plural(entry.count, 'produit', 'produits')
            : 'Aucun produit en ligne'}
        </span>
        {entry.href && (
          <span className={styles.cta} aria-hidden="true">
            {VIEW_EXTENSION_LABEL} <ArrowRight size={16} />
          </span>
        )}
      </p>
    </article>
  );
}
