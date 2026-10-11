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
  const attention = checks.filter((check) => check.state !== 'ok');
  const passed = checks.filter((check) => check.state === 'ok');
  function checkList(items: StorefrontCheck[]) {
    return (
      <ul className={styles.storefrontChecks}>
        {items.map((check) => {
          const Icon = ICONS[check.state];
          return (
            <li key={check.label} data-state={check.state}>
              <Icon size={18} aria-hidden="true" />
              <span>
                <strong>{check.label}</strong> · {check.text}
              </span>
              {check.href && check.state !== 'ok' && (
                <Link href={check.href}>
                  Corriger
                  <span className={styles.srOnly}>
                    {' '}
                    : {check.label.toLowerCase()}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    );
  }
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
            rel="noopener noreferrer"
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            <ExternalLink size={16} aria-hidden="true" />
            Voir la fiche
          </Link>
        )}
      </div>
      {attention.length > 0 ? (
        <>
          <p className={styles.storefrontHint}>
            {attention.length} point{attention.length > 1 ? 's' : ''} à vérifier
          </p>
          {checkList(attention)}
        </>
      ) : (
        <p className={styles.storefrontHint}>
          Les contrôles de visibilité sont validés.
        </p>
      )}
      {passed.length > 0 && (
        <details className={styles.passedChecks}>
          <summary>
            {passed.length} contrôle{passed.length > 1 ? 's' : ''} validé
            {passed.length > 1 ? 's' : ''}
          </summary>
          {checkList(passed)}
        </details>
      )}
    </section>
  );
}
