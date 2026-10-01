import Link from 'next/link';
import { Compass } from 'lucide-react';
import styles from './Catalog.module.scss';

export interface EmptyAction {
  href: string;
  label: string;
}

/**
 * Nothing to show here: say so plainly, then always a way out, the nearest
 * first (it stands out), the widest last. The same block on every page.
 */
export function EmptyState({
  title,
  text,
  actions,
}: {
  title: string;
  text?: string;
  actions: readonly EmptyAction[];
}) {
  return (
    <section className={styles.empty} aria-labelledby="catalogue-vide">
      <Compass size={34} strokeWidth={1.2} aria-hidden="true" />
      <h2 id="catalogue-vide">{title}</h2>
      {text && <p>{text}</p>}
      {actions.length > 0 && (
        <div className={styles.emptyActions}>
          {actions.map((action) => (
            <Link key={action.href} href={action.href}>
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
