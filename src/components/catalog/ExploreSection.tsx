import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { SeoLinkGroup } from '@/lib/seo/types';
import landing from '@/components/landing/Landing.module.scss';
import styles from './Explore.module.scss';

/**
 * After the products: where to go next, as a few short ways in grouped by
 * what they lead to, beside the page's own presentation (written in the
 * admin): its summary in view, the full text one tap away, still in the
 * page. Every link leads to an indexable page.
 */
export function ExploreSection({
  eyebrow,
  title,
  lead,
  groups,
  about,
}: {
  eyebrow: string;
  title: string;
  lead?: string | null;
  groups: readonly SeoLinkGroup[];
  /** Safe HTML of the editorial intro, behind its label. */
  about?: { label: string; html: string } | null;
}) {
  const shown = groups.filter((group) => group.links.length);
  if (!shown.length && !lead && !about?.html) return null;
  return (
    <section
      className={`${landing.section} ${styles.explore}`}
      aria-labelledby="explorer"
    >
      <div className={styles.heading}>
        <SectionTitle id="explorer" eyebrow={eyebrow} title={title} />
        {lead && <p className={styles.lead}>{lead}</p>}
      </div>
      {shown.length > 0 && (
        <div className={styles.groups}>
          {shown.map((group, index) => (
            <nav
              key={group.title}
              className={styles.group}
              aria-labelledby={`explorer-${index}`}
            >
              <h3 id={`explorer-${index}`}>{group.title}</h3>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>
                      {link.label}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      )}
      {about?.html && (
        <details className={styles.about}>
          <summary>
            {about.label}
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div
            className={landing.editorial}
            dangerouslySetInnerHTML={{ __html: about.html }}
          />
        </details>
      )}
    </section>
  );
}
