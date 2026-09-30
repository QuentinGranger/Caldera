import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { HomeJournal } from '@/components/home/homeData';
import styles from './Journal.module.scss';

const KIND_LABELS = {
  actualite: 'Actualité',
  guide: 'Guide',
  dossier: 'Dossier',
  comparatif: 'Comparatif',
  glossaire: 'Glossaire',
  question: 'Question',
} as const;

const dateFr = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

/** The latest reading: news when there is some, otherwise the guides. */
export function Journal({ journal }: { journal: HomeJournal | null }) {
  if (!journal) return null;
  return (
    <section className={styles.section} aria-labelledby="journal-title">
      <div className={styles.inner}>
        <header className={styles.head} data-reveal="">
          <div>
            <p className={styles.eyebrow}>Carnets de route</p>
            <h2 id="journal-title">
              {journal.news
                ? 'Les dernières nouvelles'
                : 'À lire avant de partir'}
            </h2>
          </div>
          <Link href={journal.href} className={styles.all}>
            {journal.news ? 'Toutes les actualités' : 'Tous les guides'}{' '}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </header>
        <ol className={styles.list}>
          {journal.entries.map((entry) => (
            <li key={entry.href} data-reveal="">
              <Link href={entry.href} className={styles.entry}>
                <span className={styles.meta}>
                  {KIND_LABELS[entry.kind]}
                  {journal.news && (
                    <>
                      {' · '}
                      <time dateTime={entry.published.toISOString()}>
                        {dateFr.format(entry.published)}
                      </time>
                    </>
                  )}
                </span>
                <span className={styles.title}>{entry.title}</span>
                <span className={styles.description}>{entry.description}</span>
                <span className={styles.arrow} aria-hidden="true">
                  <ArrowUpRight size={18} />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
