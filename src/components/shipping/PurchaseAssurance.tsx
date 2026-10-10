import Link from 'next/link';
import {
  MessageCircle,
  PackageCheck,
  PackageSearch,
  RotateCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {
  HANDLING_HEADLINE,
  PREORDER_HANDLING_LABEL,
  RETURN_POLICY_PATH,
  WITHDRAWAL_HEADLINE,
  WITHDRAWAL_TEXT,
} from '@/lib/product/services';
import styles from './PurchaseAssurance.module.scss';

/** Published policies, beside the purchase action. Demo pages only offer help. */
export function PurchaseAssurance({
  preorder = false,
  sealed = false,
  commerce = true,
  tone = 'day',
  onNavigate,
}: {
  preorder?: boolean;
  sealed?: boolean;
  commerce?: boolean;
  tone?: 'day' | 'night';
  onNavigate?: () => void;
}) {
  return (
    <ul
      className={`${styles.assurance} ${tone === 'night' ? styles.night : ''}`}
      aria-label={commerce ? 'Nos engagements' : 'Contacter Caldera'}
    >
      {commerce && (
        <>
          <li>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              <strong>Paiement sécurisé</strong>
              <small>Par Stripe</small>
            </span>
          </li>
          <li>
            <Truck size={18} aria-hidden="true" />
            <span>
              <strong>
                {preorder ? 'Commande avec précommande' : HANDLING_HEADLINE}
              </strong>
              <small>
                {preorder
                  ? PREORDER_HANDLING_LABEL
                  : 'Après confirmation du paiement'}
              </small>
            </span>
          </li>
          <li>
            <PackageSearch size={18} aria-hidden="true" />
            <span>
              <strong>Suivi colis</strong>
              <small>Par e-mail, selon le transporteur</small>
            </span>
          </li>
          <li>
            <RotateCcw size={18} aria-hidden="true" />
            <span>
              <strong>{`${WITHDRAWAL_HEADLINE} ${WITHDRAWAL_TEXT}`}</strong>
              <small>
                À compter de la réception ·{' '}
                <Link href={RETURN_POLICY_PATH} onClick={onNavigate}>
                  Conditions de retour
                </Link>
              </small>
            </span>
          </li>
        </>
      )}
      {sealed && (
        <li>
          <PackageCheck size={18} aria-hidden="true" />
          <span>
            <strong>Neuf et scellé</strong>
            <small>Produit d’origine</small>
          </span>
        </li>
      )}
      <li className={!sealed ? styles.contact : undefined}>
        <MessageCircle size={18} aria-hidden="true" />
        <span>
          <strong>Service client</strong>
          <small>
            <Link href="/contact" onClick={onNavigate}>
              Une question ? Contactez-nous
            </Link>
          </small>
        </span>
      </li>
    </ul>
  );
}
