import Link from 'next/link';
import type { CheckoutStep } from '@/lib/checkout/types';
import styles from './Checkout.module.scss';
const steps = [
  { id: 'contact', label: 'Coordonnées' },
  { id: 'shipping', label: 'Livraison' },
  { id: 'review', label: 'Récapitulatif' },
] as const;
export function CheckoutProgress({
  step,
  requiredStep,
}: {
  step: CheckoutStep | 'payment';
  requiredStep: CheckoutStep;
}) {
  const allowed = steps.findIndex((item) => item.id === requiredStep);
  return (
    <nav aria-label="Étapes de la commande" className={styles.progress}>
      <ol>
        {steps.map((item, index) => (
          <li
            key={item.id}
            aria-current={step === item.id ? 'step' : undefined}
          >
            <span aria-hidden="true">0{index + 1}</span>
            {index <= allowed && step !== 'payment' ? (
              <Link href={`/checkout?step=${item.id}`}>{item.label}</Link>
            ) : (
              <span aria-disabled="true">{item.label}</span>
            )}
          </li>
        ))}
        <li aria-current={step === 'payment' ? 'step' : undefined}>
          <span aria-hidden="true">04</span>
          <span aria-disabled={step !== 'payment' ? true : undefined}>
            Paiement
          </span>
        </li>
      </ol>
    </nav>
  );
}
