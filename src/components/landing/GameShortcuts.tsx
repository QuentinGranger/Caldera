import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { SeoLink } from '@/lib/seo/types';
import styles from './GameHub.module.scss';
import landing from './Landing.module.scss';

export interface ShortcutGroup {
  title: string;
  links: readonly SeoLink[];
}

/**
 * Game hub: its pages by format, language and availability as a few short
 * ways in, beside the presentation written in the admin: its summary in
 * view, the full text one tap away (still in the page). Only groups with an
 * indexable page.
 */
export function GameShortcuts({
  game,
  groups,
  description,
  editorialHtml,
}: {
  game: string;
  groups: readonly ShortcutGroup[];
  description: string | null;
  /** Safe HTML of the game's editorial intro. */
  editorialHtml: string;
}) {
  const shown = groups.filter((group) => group.links.length);
  if (!shown.length && !description && !editorialHtml) return null;
  return (
    <section
      className={`${landing.section} ${styles.explore}`}
      aria-labelledby="explorer"
    >
      <div className={styles.exploreHeading}>
        <SectionTitle
          id="explorer"
          eyebrow="Raccourcis"
          title={`Explorer ${game}`}
        />
        {description && <p className={styles.exploreLead}>{description}</p>}
      </div>
      {shown.length > 0 && (
        <div className={styles.shortcuts}>
          {shown.map((group, index) => (
            <nav
              key={group.title}
              className={styles.shortcutGroup}
              aria-labelledby={`raccourcis-${index}`}
            >
              <h3 id={`raccourcis-${index}`}>{group.title}</h3>
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
      {editorialHtml && (
        <details className={styles.about}>
          <summary>
            En savoir plus sur {game}
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div
            className={landing.editorial}
            dangerouslySetInnerHTML={{ __html: editorialHtml }}
          />
        </details>
      )}
    </section>
  );
}
