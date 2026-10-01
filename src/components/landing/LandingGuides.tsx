import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { ContentEntry, ContentKind } from '@/lib/content';
import styles from './Landing.module.scss';

const KIND_LABELS: Record<ContentKind, string> = {
  guide: 'Guide',
  comparatif: 'Comparatif',
  dossier: 'Dossier',
  glossaire: 'Glossaire',
  question: 'Question',
  actualite: 'Actualité',
};

/**
 * Guides and glossary terms of the page scope, as a short selection: a few
 * lines each, the whole card opens the article. `limit` keeps the first
 * (most specific) ones; `more` leads to the full list.
 */
export function LandingGuides({
  entries,
  subject,
  limit,
  more,
}: {
  entries: readonly ContentEntry[];
  subject: string;
  limit?: number;
  more?: { href: string; label: string };
}) {
  const shown = limit ? entries.slice(0, limit) : entries;
  if (!shown.length) return null;
  return (
    <section className={styles.section} aria-labelledby="guides">
      <SectionTitle id="guides" eyebrow={subject} title="Guides et glossaire" />
      <ul className={styles.guides}>
        {shown.map((entry) => (
          <li key={entry.href} className={styles.guide}>
            <span className={styles.kind}>{KIND_LABELS[entry.kind]}</span>
            <h3>
              <Link href={entry.href}>{entry.title}</Link>
            </h3>
            <p>{entry.description}</p>
            <ArrowRight className={styles.guideArrow} aria-hidden="true" />
          </li>
        ))}
      </ul>
      {more && (
        <p className={styles.moreLink}>
          <Link href={more.href}>
            {more.label} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </p>
      )}
    </section>
  );
}
