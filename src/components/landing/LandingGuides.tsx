import Link from 'next/link';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { ContentEntry, ContentKind } from '@/lib/content';
import styles from './Landing.module.scss';

const KIND_LABELS: Record<ContentKind, string> = {
  guide: 'Guide',
  comparatif: 'Comparatif',
  dossier: 'Dossier',
  glossaire: 'Glossaire',
};

/** Guides and glossary terms of the page scope. */
export function LandingGuides({
  entries,
  subject,
}: {
  entries: readonly ContentEntry[];
  subject: string;
}) {
  if (!entries.length) return null;
  return (
    <section className={styles.section} aria-labelledby="guides">
      <SectionTitle id="guides" eyebrow={subject} title="Guides et glossaire" />
      <ul className={styles.guides}>
        {entries.map((entry) => (
          <li key={entry.href} className={styles.guide}>
            <span className={styles.kind}>{KIND_LABELS[entry.kind]}</span>
            <Link href={entry.href}>{entry.title}</Link>
            <p>{entry.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
