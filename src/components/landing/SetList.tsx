import Image from 'next/image';
import Link from 'next/link';
import { formatDateFr } from '@/lib/seo/metadata';
import type { SetEntry } from './landingData';
import { plural } from './landingText';
import styles from './Landing.module.scss';

/** Set cards: a link only when the set page is indexable. */
export function SetList({
  entries,
  showGame = false,
}: {
  entries: readonly SetEntry[];
  showGame?: boolean;
}) {
  return (
    <ul className={styles.sets}>
      {entries.map((entry) => (
        <li key={entry.id} className={styles.set}>
          {entry.upcoming && <span className={styles.badge}>À paraître</span>}
          {entry.logoUrl && (
            <Image src={entry.logoUrl} alt="" width={140} height={60} />
          )}
          <p className={styles.setName}>
            {entry.href ? (
              <Link href={entry.href}>{entry.name}</Link>
            ) : (
              entry.name
            )}
          </p>
          {showGame && entry.gameName && (
            <p className={styles.meta}>{entry.gameName}</p>
          )}
          {entry.series && <p className={styles.meta}>{entry.series}</p>}
          {(entry.code || entry.releaseDate) && (
            <p className={styles.meta}>
              {entry.code && `Code ${entry.code}`}
              {entry.code && entry.releaseDate && ' · '}
              {entry.releaseDate && (
                <>
                  {entry.upcoming ? 'Sortie prévue le ' : 'Sortie le '}
                  <time dateTime={entry.releaseDate.toISOString().slice(0, 10)}>
                    {formatDateFr(entry.releaseDate)}
                  </time>
                </>
              )}
            </p>
          )}
          <p className={styles.meta}>
            {entry.count
              ? plural(entry.count, 'produit', 'produits')
              : 'Aucun produit en ligne'}
          </p>
        </li>
      ))}
    </ul>
  );
}
