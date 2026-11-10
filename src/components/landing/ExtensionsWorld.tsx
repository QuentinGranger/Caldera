import Link from 'next/link';
import { PageHero } from '@/components/catalog/PageHero';
import { ArrowDown, ArrowUpRight, CalendarDays } from 'lucide-react';
import styles from './ExtensionsWorld.module.scss';

/** The release index starts with the facts, then actual extension visuals. */
export function ExtensionsHero({ calendar }: { calendar: boolean }) {
  return (
    <PageHero
      breadcrumb={[{ label: 'Accueil', href: '/' }, { label: 'Extensions' }]}
      path="/extensions"
      eyebrow="Par date de sortie"
      title="Les extensions Pokémon"
      lead="Sorties annoncées, dernières parutions et collections déjà sorties."
      up={
        calendar
          ? { href: '/calendrier-des-sorties', label: 'Calendrier des sorties' }
          : undefined
      }
      view={{ src: '/assets/images/editorial/foret.png', frame: 'backdrop' }}
    />
  );
}

export function ExtensionsNavigation({
  entries,
}: {
  entries: readonly { href: string; label: string; count: number }[];
}) {
  return (
    <nav
      id="chronologie"
      className={styles.navigation}
      aria-label="Parcourir les extensions"
    >
      <p className={styles.eyebrow}>Votre prochaine exploration</p>
      <ol>
        {entries.map((entry, index) => (
          <li key={entry.href}>
            <a href={entry.href}>
              <span className={styles.navNumber} aria-hidden="true">
                0{index + 1}
              </span>
              <span>
                <strong>{entry.label}</strong>
                <small>
                  {`${entry.count} ${entry.count > 1 ? 'extensions' : 'extension'}`}
                </small>
              </span>
              <ArrowDown size={19} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ExtensionsGuide() {
  return (
    <aside className={styles.guide} aria-labelledby="extensions-guide-title">
      <div>
        <p className={styles.eyebrow}>Les repères du collectionneur</p>
        <h2 id="extensions-guide-title">Comprendre les extensions</h2>
      </div>
      <div>
        <p>
          Séries, extensions, numérotation : découvrez comment se repérer dans
          le JCC Pokémon et choisir ce que vous souhaitez collectionner.
        </p>
        <Link href="/guides/extensions-et-series-pokemon">
          Comprendre les extensions{' '}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <CalendarDays
        className={styles.guideMark}
        size={150}
        strokeWidth={0.6}
        aria-hidden="true"
      />
    </aside>
  );
}
