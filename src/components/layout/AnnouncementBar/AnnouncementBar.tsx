import { Compass } from 'lucide-react';
import { HANDLING_TIME } from '@/lib/seo/policies';
import styles from './AnnouncementBar.module.scss';
// Delivery zone and preparation time from the CGV (art. 10.1 and 10.3).
export function AnnouncementBar() {
  return (
    <div className={styles.bar}>
      <Compass size={13} aria-hidden="true" />
      <p>
        Livraison en France métropolitaine{' '}
        <span>
          — Commandes préparées sous {HANDLING_TIME.minDays} à{' '}
          {HANDLING_TIME.maxDays} jours ouvrés après paiement.
        </span>
      </p>
    </div>
  );
}
