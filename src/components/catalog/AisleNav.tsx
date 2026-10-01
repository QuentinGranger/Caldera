import Link from 'next/link';
import type { SeoLink } from '@/lib/seo/types';
import { ChipRow } from './ChipRow';
import { PendingHint } from './PendingHint';
import styles from './Catalog.module.scss';

/**
 * The shop's aisles, the same row on each of their pages: every aisle is a
 * page of its own, the current one marked. Swiped on phones, like the
 * family chips it stands for.
 */
export function AisleNav({
  aisles,
  current,
  label = 'Rayons de la boutique',
}: {
  aisles: readonly SeoLink[];
  /** Path of the page: its aisle is marked as current. */
  current?: string;
  label?: string;
}) {
  if (aisles.length < 2) return null;
  return (
    <nav className={styles.quickNav} aria-label={label}>
      <ChipRow key={current}>
        {aisles.map((aisle) => (
          <li key={aisle.href}>
            <Link
              href={aisle.href}
              aria-current={aisle.href === current ? 'page' : undefined}
            >
              {aisle.label}
              {aisle.count !== undefined && (
                <>
                  {' '}
                  <span className={styles.quickCount}>
                    {aisle.count}
                    <span className={styles.srOnly}> produits</span>
                  </span>
                </>
              )}
              <PendingHint />
            </Link>
          </li>
        ))}
      </ChipRow>
    </nav>
  );
}
