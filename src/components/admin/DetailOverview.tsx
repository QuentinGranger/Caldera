import type { ReactNode } from 'react';
import styles from './Admin.module.scss';

export function DetailOverview({
  visual,
  entries,
}: {
  visual?: ReactNode;
  entries: { label: string; value: ReactNode; detail?: string }[];
}) {
  return (
    <section className={styles.detailOverview} aria-label="Vue d’ensemble">
      {visual && <div className={styles.overviewVisual}>{visual}</div>}
      <dl>
        {entries.map((entry) => (
          <div key={entry.label}>
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
            {entry.detail && (
              <dd className={styles.overviewDetail}>{entry.detail}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
