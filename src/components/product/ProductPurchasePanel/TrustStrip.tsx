import Link from 'next/link';
import { PackageCheck, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  RETURN_POLICY_PATH,
  WITHDRAWAL_HEADLINE,
  WITHDRAWAL_TEXT,
} from '@/lib/product/services';
import styles from './TrustStrip.module.scss';

/**
 * What the shop really commits to, under the buy button. Each item rests on
 * a published text: sealed goods (CGV art. 3, by product type), payment by
 * Stripe (only while orders are open), the 14 days of withdrawal (CGV art.
 * 12, whose costs the « Retours » block below spells out).
 */
export function TrustStrip({
  sealed,
  secureOrders,
}: {
  /** A sealed type: « neuf et scellé »; any other product is only « neuf » below. */
  sealed: boolean;
  /** Orders are open: delivery methods are live. */
  secureOrders: boolean;
}) {
  return (
    <ul className={styles.trust} aria-label="Nos engagements">
      {sealed && (
        <li>
          <PackageCheck size={20} aria-hidden="true" />
          <span>
            <strong>Neuf et scellé</strong>
            <small>Produit d’origine</small>
          </span>
        </li>
      )}
      {secureOrders && (
        <li>
          <ShieldCheck size={20} aria-hidden="true" />
          <span>
            <strong>Paiement sécurisé</strong>
            <small>Par Stripe</small>
          </span>
        </li>
      )}
      <li>
        <RotateCcw size={20} aria-hidden="true" />
        <span>
          <strong>{WITHDRAWAL_HEADLINE}</strong>
          <small>
            <Link href={RETURN_POLICY_PATH}>{WITHDRAWAL_TEXT}</Link>
          </small>
        </span>
      </li>
    </ul>
  );
}
