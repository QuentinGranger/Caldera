import Link from 'next/link';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import { formatDateFr } from '@/lib/seo/metadata';
import type { CalendarEntry } from './releaseData';
import { groupByMonth, releaseStockText } from './landingText';
import styles from './Landing.module.scss';

/** Releases grouped by month, each with its game, series, code and stock. */
export function ReleaseMonths({
  id,
  title,
  eyebrow,
  entries,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  entries: readonly CalendarEntry[];
}) {
  if (!entries.length) return null;
  return (
    <section className={styles.lead} aria-labelledby={id}>
      <SectionTitle id={id} eyebrow={eyebrow} title={title} />
      {groupByMonth(entries).map((month) => (
        <div key={month.key} className={styles.month}>
          <h3 className={styles.monthTitle}>{month.label}</h3>
          <ul className={styles.releases}>
            {month.entries.map((entry) => (
              <li key={entry.id} className={styles.release}>
                <time
                  className={styles.releaseDate}
                  dateTime={entry.releaseDate.toISOString().slice(0, 10)}
                >
                  {formatDateFr(entry.releaseDate)}
                </time>
                <div>
                  <p className={styles.setName}>
                    {entry.href ? (
                      <Link href={entry.href}>{entry.name}</Link>
                    ) : (
                      entry.name
                    )}
                  </p>
                  <p className={styles.meta}>
                    {[
                      entry.gameName,
                      entry.series,
                      entry.code ? `Code ${entry.code}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <p className={styles.releaseStock}>{releaseStockText(entry)}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
