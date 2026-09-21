'use client';
import Link from 'next/link';
import { StartPaymentButton } from '@/components/payment/StartPaymentButton';
import { Button } from '@/components/ui/Button/Button';
import { prepareCheckoutAction } from '@/lib/checkout/actions';
import type { CheckoutView } from '@/lib/checkout/types';
import { formatPrice } from '@/utils/formatPrice';
import { AddressSummary } from './AddressSummary';
import { useCheckoutAction } from './useCheckoutAction';
import styles from './Checkout.module.scss';
export function CheckoutReview({ view }: { view: CheckoutView }) {
  const { execute, pending, result } = useCheckoutAction();
  return (
    <div>
      <section className={styles.reviewBlock}>
        <h2>
          Coordonnées <Link href="/checkout?step=contact">Modifier</Link>
        </h2>
        <p>
          {view.contact.shipping.firstName} {view.contact.shipping.lastName}
        </p>
        <p className={styles.wrap}>{view.contact.email}</p>
        {view.contact.phone && <p>{view.contact.phone}</p>}
      </section>
      <section className={styles.reviewBlock}>
        <h2>
          Livraison{' '}
          <Link href="/checkout?step=contact">Modifier l’adresse</Link>
        </h2>
        <AddressSummary
          address={view.contact.shipping}
          countries={view.countries}
        />
        <p>
          {view.selectedMethod?.name} ·{' '}
          {view.shippingAmount === '0.00'
            ? 'Offerte'
            : formatPrice(view.shippingAmount ?? '0')}
        </p>
        {view.pickupPoint && (
          <div className={styles.reviewPickup}>
            <strong>{view.pickupPoint.name}</strong>
            <span>{view.pickupPoint.address1}</span>
            <span>
              {view.pickupPoint.postalCode} {view.pickupPoint.city}
            </span>
            <small>Point de retrait n° {view.pickupPoint.pointId}</small>
          </div>
        )}
        <Link href="/checkout?step=shipping">
          Modifier le mode de livraison
        </Link>
      </section>
      <section className={styles.reviewBlock}>
        <h2>
          Facturation <Link href="/checkout?step=contact">Modifier</Link>
        </h2>
        {view.contact.billingSame && (
          <p className={styles.hint}>Identique à l’adresse de livraison.</p>
        )}
        <AddressSummary
          address={
            view.contact.billingSame
              ? view.contact.shipping
              : view.contact.billing!
          }
          countries={view.countries}
        />
      </section>
      {view.status !== 'READY_FOR_PAYMENT' && (
        <Button
          disabled={pending}
          onClick={() =>
            execute(() => prepareCheckoutAction(view.sessionId), false)
          }
        >
          {pending ? 'Vérification…' : 'Valider mon récapitulatif'}
        </Button>
      )}
      <p role="status" className={styles.feedback}>
        {result?.message ||
          (view.status === 'READY_FOR_PAYMENT'
            ? 'Votre récapitulatif est validé. Vous pouvez préparer votre paiement.'
            : '')}
      </p>
      <div className={styles.payment}>
        <StartPaymentButton
          sessionId={view.sessionId!}
          disabled={view.status !== 'READY_FOR_PAYMENT'}
        />
        <p>
          En poursuivant vers le paiement, vous reconnaissez avoir pris
          connaissance et accepter les <Link href="/cgv">Conditions Générales de Vente</Link>.
        </p>
        <p>
          Votre sélection sera réservée pendant 20 minutes au passage au
          paiement.
        </p>
      </div>
    </div>
  );
}
