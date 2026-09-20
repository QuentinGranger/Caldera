import type { ShippingMethodView } from '@/lib/checkout/types';
import { formatPrice } from '@/utils/formatPrice';
import styles from './Checkout.module.scss';
export function ShippingMethodCard({
  method,
  selected,
  disabled,
  onChange,
}: {
  method: ShippingMethodView;
  selected: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label className={styles.shippingCard}>
      <input
        type="radio"
        name="shippingMethodId"
        value={method.id}
        checked={selected}
        disabled={disabled}
        onChange={onChange}
      />
      <span>
        <strong>{method.name}</strong>
        {method.description && <span>{method.description}</span>}
        {method.estimatedMinDays !== null &&
          method.estimatedMaxDays !== null && (
            <span>
              Délai indicatif : {method.estimatedMinDays} à{' '}
              {method.estimatedMaxDays} jours ouvrés
            </span>
          )}
      </span>
      <strong>
        {method.amount === '0.00' ? 'Offerte' : formatPrice(method.amount)}
      </strong>
    </label>
  );
}
