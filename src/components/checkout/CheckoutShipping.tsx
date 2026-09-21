'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import {
  prepareCheckoutAction,
  setShippingMethodAction,
} from '@/lib/checkout/actions';
import type { CheckoutView } from '@/lib/checkout/types';
import { ShippingMethodCard } from './ShippingMethodCard';
import { useCheckoutAction } from './useCheckoutAction';
import styles from './Checkout.module.scss';
import { PickupPointSelector } from './PickupPointSelector';
export function CheckoutShipping({ view }: { view: CheckoutView }) {
  const { pending, result, execute } = useCheckoutAction();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        execute(() => prepareCheckoutAction(view.sessionId));
      }}
    >
      <fieldset className={styles.formSection} disabled={pending}>
        <legend>Choisissez votre livraison</legend>
        <p className={styles.hint}>
          Destination : {view.contact.shipping.city},{' '}
          {
            view.countries.find(
              (country) => country.code === view.contact.shipping.countryCode,
            )?.name
          }
        </p>
        {view.methods.map((method) => (
          <ShippingMethodCard
            key={method.id}
            method={method}
            selected={view.selectedMethod?.id === method.id}
            disabled={pending}
            onChange={() =>
              execute(
                () => setShippingMethodAction(view.sessionId, method.id),
                false,
              )
            }
          />
        ))}
        {view.selectedMethod?.code === 'MONDIAL_RELAY_PICKUP' &&
          view.sessionId && (
            <PickupPointSelector
              sessionId={view.sessionId}
              countryCode={view.contact.shipping.countryCode}
              initialPostalCode={view.contact.shipping.postalCode}
              initialCity={view.contact.shipping.city}
              selected={view.pickupPoint}
            />
          )}
        {!view.methods.length && (
          <p role="status" className={styles.notice}>
            Nous ne proposons actuellement aucun mode de livraison pour cette
            destination.
          </p>
        )}
      </fieldset>
      <p role="status" className={styles.feedback}>
        {pending ? 'Enregistrement…' : result?.message}
      </p>
      <div className={styles.actions}>
        <Link href="/checkout?step=contact">Modifier les coordonnées</Link>
        <Button
          type="submit"
          disabled={
            pending ||
            !view.selectedMethod ||
            (view.selectedMethod.code === 'MONDIAL_RELAY_PICKUP' &&
              !view.pickupPoint)
          }
        >
          {pending ? 'Enregistrement…' : 'Vérifier mon récapitulatif'}
        </Button>
      </div>
    </form>
  );
}
