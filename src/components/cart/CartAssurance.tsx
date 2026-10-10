import { ShieldCheck, Truck } from 'lucide-react';
import {
  HANDLING_HEADLINE,
  PREORDER_HANDLING_LABEL,
} from '@/lib/product/services';
import styles from './CartAssurance.module.scss';

export function CartAssurance({
  preorder = false,
  tone = 'day',
}: {
  preorder?: boolean;
  tone?: 'day' | 'night';
}) {
  return (
    <ul
      className={`${styles.assurance} ${tone === 'night' ? styles.night : ''}`}
      aria-label="Expédition et paiement"
    >
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
        <ShieldCheck size={18} aria-hidden="true" />
        <span>
          <strong>Paiement sécurisé</strong>
          <small>Via Stripe, à l’étape paiement</small>
        </span>
      </li>
    </ul>
  );
}
