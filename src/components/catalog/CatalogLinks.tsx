import Link from 'next/link';
import { useId } from 'react';
import type { SeoLinkGroup } from '@/lib/seo/types';
import styles from './Catalog.module.scss';

/** Internal links to indexable pages, one titled list per group. */
export function CatalogLinks({ groups }: { groups: readonly SeoLinkGroup[] }) {
  const id = useId();
  const visible = groups.filter((group) => group.links.length);
  if (!visible.length) return null;
  return (
    <div className={styles.linkGroups}>
      {visible.map((group, index) => (
        <section
          key={group.title}
          className={styles.linkGroup}
          aria-labelledby={`${id}-${index}`}
        >
          <h2 id={`${id}-${index}`}>{group.title}</h2>
          <ul>
            {group.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
                {link.count !== undefined && (
                  <span className={styles.linkCount}>
                    {link.count} {link.count > 1 ? 'produits' : 'produit'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
