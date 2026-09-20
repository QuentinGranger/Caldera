'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/utils/formatPrice';
import type { CheckoutStep, CheckoutView } from '@/lib/checkout/types';
import { CheckoutProgress } from './CheckoutProgress';
import { CheckoutSummary } from './CheckoutSummary';
import { CheckoutContactForm } from './CheckoutContactForm';
import { CheckoutShipping } from './CheckoutShipping';
import { CheckoutReview } from './CheckoutReview';
import { StartCheckoutButton } from './StartCheckoutButton';
import { CheckoutSync } from './CheckoutSync';
import styles from './Checkout.module.scss';
const titles = {
  contact: 'Vos coordonnées',
  shipping: 'Votre livraison',
  review: 'Avant de poursuivre',
};
export function CheckoutFlow({
  view,
  step,
}: {
  view: CheckoutView;
  step: CheckoutStep;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  return (
    <>
      {view.sessionId && <CheckoutSync />}
      <CheckoutProgress step={step} requiredStep={view.requiredStep} />
      <div className={styles.grid}>
        <div>
          <span className={styles.eyebrow}>VOTRE EXPÉDITION CALDERA</span>
          <h1 ref={heading} tabIndex={-1} className={styles.title}>
            {titles[step]}
          </h1>
          <p className={styles.mobileTotal}>
            Total provisoire :{' '}
            <strong>
              {view.total === null
                ? `${formatPrice(view.cart.subtotal)} + livraison`
                : formatPrice(view.total)}
            </strong>
            <a href="#checkout-summary">Voir le détail</a>
          </p>
          {view.notice && (
            <p className={styles.notice} role="status">
              {view.notice}
            </p>
          )}
          {view.blocked ? (
            <Link className={styles.returnLink} href="/panier">
              Vérifier mon panier
            </Link>
          ) : !view.sessionId || view.status === 'EXPIRED' ? (
            <StartCheckoutButton restart={view.status === 'EXPIRED'} />
          ) : step === 'contact' ? (
            <CheckoutContactForm view={view} />
          ) : step === 'shipping' ? (
            <CheckoutShipping view={view} />
          ) : (
            <CheckoutReview view={view} />
          )}
        </div>
        <CheckoutSummary view={view} />
      </div>
    </>
  );
}
