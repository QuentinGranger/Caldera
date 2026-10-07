import Link from 'next/link';
import { CircleAlert, CircleCheck, CircleX, ExternalLink } from 'lucide-react';
import type { StorefrontCheck } from '@/lib/admin/storefront';
import styles from './Admin.module.scss';

const ICONS = { ok: CircleCheck, warn: CircleAlert, block: CircleX } as const;

/** Whether the product reaches the shop, and what keeps it out if not. */
export function StorefrontPanel({
  listed,
  checks,
  href,
}: {
  listed: boolean;
  checks: StorefrontCheck[];
  href: string;
}) {
  return (
    <section
      className={`${styles.card} ${styles.storefront}`}
      data-listed={listed ? '' : undefined}
      aria-labelledby="storefront-title"
    >
      <div className={styles.panelHeader}>
        <h2 id="storefront-title">
          {listed ? 'En ligne sur la boutique' : 'Invisible sur la boutique'}
        </h2>
        {listed && (
          <Link
            href={href}
            target="_blank"
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            <ExternalLink size={16} aria-hidden="true" />
            Voir la fiche
          </Link>
        )}
      </div>
      <ul className={styles.storefrontChecks}>
        {checks.map((check) => {
          const Icon = ICONS[check.state];
          return (
            <li key={check.label} data-state={check.state}>
              <Icon size={18} aria-hidden="true" />
              <span>
                <strong>{check.label}</strong> · {check.text}
                {check.href && check.state !== 'ok' && (
                  <>
                    {' '}
                    <Link href={check.href}>Corriger</Link>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
