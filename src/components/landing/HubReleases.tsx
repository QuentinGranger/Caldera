import Link from 'next/link';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import {
  CALENDAR_PATH,
  EXTENSIONS_PATH,
  type LandingView,
} from './landingData';
import { SetList } from './SetList';
import styles from './Landing.module.scss';

/** Game hub: announced sets with their date, then the latest ones. */
export function HubReleases({ view }: { view: LandingView }) {
  const upcoming = view.releases?.upcoming ?? [];
  const recent = view.releases?.recent ?? [];
  if (!upcoming.length && !recent.length) return null;
  const game = view.game;
  return (
    <section className={styles.lead} aria-labelledby="extensions">
      <SectionTitle
        id="extensions"
        eyebrow="Sorties et extensions"
        title={`Extensions ${game.name}`}
        link={
          view.calendarIndexable
            ? { href: CALENDAR_PATH, label: 'Calendrier des sorties' }
            : undefined
        }
      />
      {upcoming.length > 0 && (
        <>
          <h3 className={styles.subheading}>Prochaines sorties</h3>
          <SetList entries={upcoming} />
        </>
      )}
      {recent.length > 0 && (
        <>
          <h3 className={styles.subheading}>Extensions récentes</h3>
          <SetList entries={recent} />
        </>
      )}
      <p className={styles.more}>
        <Link href={`${EXTENSIONS_PATH}#${game.slug}`}>
          Toutes les extensions {game.name}
        </Link>
      </p>
    </section>
  );
}
