import Link from 'next/link';
import type { SeoLink } from '@/lib/seo/types';
import { truncateAtWord } from '@/lib/seo/metadata';
import styles from './ProductExplore.module.scss';

type ContentLink = {
  href: string;
  title: string;
  description?: string;
  definition?: string;
};

/** « Voir aussi »: indexable landings, glossary term and guides of the product. */
export function ProductExplore({
  links,
  glossary,
  guides,
}: {
  links: SeoLink[];
  glossary: ContentLink | null;
  guides: ContentLink[];
}) {
  if (!links.length && !glossary && !guides.length) return null;
  return (
    <section className={styles.explore} aria-labelledby="explore-title">
      <h2 id="explore-title">Voir aussi</h2>
      <div className={styles.columns}>
        {links.length > 0 && (
          <div className={styles.column}>
            <h3>Autour de ce produit</h3>
            <ul>
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                  {link.count !== undefined && (
                    <span className={styles.count}>
                      {link.count} {link.count > 1 ? 'produits' : 'produit'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {glossary && (
          <div className={styles.column}>
            <h3>Définition</h3>
            <p className={styles.term}>
              <Link href={glossary.href}>{glossary.title}</Link>
            </p>
            {glossary.definition && (
              <p className={styles.text}>
                {truncateAtWord(glossary.definition, 320)}
              </p>
            )}
          </div>
        )}
        {guides.length > 0 && (
          <div className={styles.column}>
            <h3>Guides</h3>
            <ul>
              {guides.map((guide) => (
                <li key={guide.href} className={styles.guide}>
                  <Link href={guide.href}>{guide.title}</Link>
                  {guide.description && (
                    <p className={styles.text}>{guide.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
