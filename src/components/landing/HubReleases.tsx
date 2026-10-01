import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import { formatDateFr } from '@/lib/seo/metadata';
import {
  CALENDAR_PATH,
  EXTENSIONS_PATH,
  type LandingView,
  type SetEntry,
} from './landingData';
import { plural } from './landingText';
import styles from './GameHub.module.scss';
import landing from './Landing.module.scss';

/** Three sets at most: the next release, then the latest ones. */
const SHOWN = 3;

function ReleaseCard({ entry, next }: { entry: SetEntry; next: boolean }) {
  const date = entry.releaseDate && (
    <time dateTime={entry.releaseDate.toISOString().slice(0, 10)}>
      {formatDateFr(entry.releaseDate)}
    </time>
  );
  return (
    <article className={`${styles.release} ${next ? styles.next : ''}`}>
      <p className={styles.releaseLabel}>
        {next ? 'Prochaine sortie' : date ? <>Sortie le {date}</> : 'Extension'}
      </p>
      {entry.logoUrl && (
        <Image
          className={styles.releaseLogo}
          src={entry.logoUrl}
          alt=""
          width={140}
          height={60}
        />
      )}
      <h3>
        {entry.href ? <Link href={entry.href}>{entry.name}</Link> : entry.name}
      </h3>
      {next && date && <p className={styles.releaseDate}>{date}</p>}
      {entry.series && <p className={styles.releaseMeta}>{entry.series}</p>}
      <p className={styles.releaseCount}>
        {entry.count
          ? plural(entry.count, 'produit', 'produits')
          : 'Aucun produit en ligne'}
        {entry.href && <ArrowRight size={16} aria-hidden="true" />}
      </p>
    </article>
  );
}

/**
 * Game hub, after the products: the next release and the latest sets, a
 * few cards swiped on phones; the calendar and every set one link away.
 */
export function HubReleases({ view }: { view: LandingView }) {
  const next = view.releases?.upcoming[0];
  const recent = (view.releases?.recent ?? []).slice(
    0,
    next ? SHOWN - 1 : SHOWN,
  );
  if (!next && !recent.length) return null;
  const game = view.game;
  return (
    <section className={landing.section} aria-labelledby="extensions">
      <SectionTitle
        id="extensions"
        eyebrow="Sorties et extensions"
        title={
          next ? 'Suivre les prochaines extensions' : 'Les dernières extensions'
        }
        link={
          view.calendarIndexable
            ? { href: CALENDAR_PATH, label: 'Voir le calendrier' }
            : undefined
        }
      />
      <ul className={styles.rail}>
        {next && (
          <li>
            <ReleaseCard entry={next} next />
          </li>
        )}
        {recent.map((entry) => (
          <li key={entry.id}>
            <ReleaseCard entry={entry} next={false} />
          </li>
        ))}
      </ul>
      <p className={landing.moreLink}>
        <Link href={`${EXTENSIONS_PATH}#${game.slug}`}>
          Voir toutes les extensions <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </p>
    </section>
  );
}
