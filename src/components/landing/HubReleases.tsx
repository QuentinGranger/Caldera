import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import {
  CALENDAR_PATH,
  EXTENSIONS_PATH,
  type LandingView,
} from './landingData';
import { SetCard } from './SetCard';
import styles from './Sets.module.scss';
import landing from './Landing.module.scss';

/** Three sets at most: the next release, then the latest ones. */
const SHOWN = 3;

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
            <SetCard entry={next} featured />
          </li>
        )}
        {recent.map((entry) => (
          <li key={entry.id}>
            <SetCard entry={entry} />
          </li>
        ))}
      </ul>
      <p className={landing.moreLink}>
        <Link href={EXTENSIONS_PATH}>
          Voir toutes les extensions <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </p>
    </section>
  );
}
