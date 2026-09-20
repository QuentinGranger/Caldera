import type { ProductBadgeKind } from '@/types/product';
import styles from './ProductBadge.module.scss';
const labels: Record<ProductBadgeKind, string> = {
  new: 'Nouveau',
  preorder: 'Précommande',
  'sold-out': 'Rupture',
  limited: 'Dernières pièces',
};
export function ProductBadge({ kind }: { kind: ProductBadgeKind }) {
  return (
    <span className={`${styles.badge} ${styles[kind]}`}>{labels[kind]}</span>
  );
}
