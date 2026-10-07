import { Compass } from 'lucide-react';
import { DELIVERY_ZONE, handlingLabel } from '@/components/editorial/delivery';
import styles from './AnnouncementBar.module.scss';

/** Who Caldera is for, then the shipping promise of the CGV (art. 10). */
export function AnnouncementBar() {
  if (process.env.CATALOG_DEMO_MODE === '1')
    return (
      <div className={styles.bar}>
        <Compass size={13} aria-hidden="true" />
        <p>
          Catalogue de démonstration · Produits d’exemple · Aucun achat possible
        </p>
      </div>
    );
  return (
    <div className={styles.bar}>
      <Compass size={13} aria-hidden="true" />
      <p>
        Boutique spécialisée {'Pokémon\u00a0TCG'}{' '}
        <span>
          · Expédition sous {handlingLabel()} en {DELIVERY_ZONE}
        </span>
      </p>
    </div>
  );
}
