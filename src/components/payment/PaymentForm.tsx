'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import { Button } from '@/components/ui/Button/Button';
import {
  checkPaymentAction,
  retryPaymentAction,
  cancelPaymentAction,
} from '@/lib/payments/actions';
import { formatPrice } from '@/utils/formatPrice';
import styles from './Payment.module.scss';

const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: ReturnType<typeof loadStripe> | undefined;

function getBrowserStripe() {
  return (stripePromise ??= loadStripe(key!));
}

type PaymentResult = Awaited<ReturnType<typeof retryPaymentAction>>;

export function PaymentForm({
  publicId,
  amount,
  expiresAt,
}: {
  publicId: string;
  amount: string;
  expiresAt: string;
}) {
  const [result, setResult] = useState<PaymentResult | null>(null);

  useEffect(() => {
    let active = true;

    retryPaymentAction(publicId)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active)
          setResult({
            success: false,
            retryable: true,
            message: 'Impossible de joindre le paiement. Réessayez.',
          });
      });

    return () => {
      active = false;
    };
  }, [publicId]);

  async function retry() {
    setResult(null);

    try {
      setResult(await retryPaymentAction(publicId));
    } catch {
      setResult({
        success: false,
        retryable: true,
        message: 'Impossible de joindre le paiement. Réessayez.',
      });
    }
  }

  return (
    <section className={styles.panel}>
      <h2>Paiement sécurisé</h2>
      <p className={styles.note}>
        Environnement de test Stripe · Aucun débit réel.
      </p>

      {!result && <p role="status">Préparation du paiement…</p>}

      {result && !result.success && (
        <>
          <p role="alert">{result.message}</p>
          {result.retryable && (
            <Button type="button" onClick={retry}>
              Réessayer
            </Button>
          )}
        </>
      )}

      {result?.success && key?.startsWith('pk_test_') && (
        <Elements
          stripe={getBrowserStripe()}
          options={{
            clientSecret: result.clientSecret,
            locale: 'fr',
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#003c2d',
                colorBackground: '#fffcf5',
                colorText: '#071c17',
                colorDanger: '#a9361c',
                borderRadius: '6px',
                fontFamily: 'system-ui, sans-serif',
              },
            },
          }}
        >
          <ConfirmForm
            publicId={publicId}
            amount={amount}
            returnUrl={result.returnUrl}
            expiresAt={expiresAt}
          />
        </Elements>
      )}

      <div className={styles.actions}>
        <CancelPayment publicId={publicId} />
        <Link href={`/commande/${publicId}`}>Consulter le statut</Link>
      </div>
    </section>
  );
}

function ConfirmForm({
  publicId,
  amount,
  returnUrl,
  expiresAt,
}: {
  publicId: string;
  amount: string;
  returnUrl: string;
  expiresAt: string;
}) {
  const stripe = useStripe(),
    elements = useElements(),
    busy = useRef(false);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [expired, setExpired] = useState(false),
    [ready, setReady] = useState(false);

  useEffect(() => {
    const tick = () => setExpired(Date.now() >= Date.parse(expiresAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (!stripe || !elements || busy.current) return;
        busy.current = true;
        setPending(true);
        setMessage('');

        try {
          const check = await checkPaymentAction(publicId);
          if (!check.success) {
            setMessage(check.message);
            return;
          }

          const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl },
          });

          setMessage(
            error.type === 'card_error' || error.type === 'validation_error'
              ? error.message || 'Vérifiez vos informations de paiement.'
              : 'Le paiement n’a pas pu être confirmé. Réessayez ou consultez le statut de votre commande.',
          );
        } catch {
          setMessage(
            'Connexion interrompue. Consultez le statut de la commande avant de réessayer.',
          );
        } finally {
          busy.current = false;
          setPending(false);
        }
      }}
    >
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={() =>
          setMessage('Le formulaire Stripe ne peut pas être chargé. Réessayez.')
        }
        options={{ layout: 'tabs' }}
      />

      <p role="alert" className={styles.feedback}>
        {expired
          ? 'La durée de réservation est écoulée. Annulez cette tentative pour recommencer.'
          : message}
      </p>

      <Button
        type="submit"
        disabled={!stripe || !elements || !ready || pending || expired}
      >
        {pending ? 'Confirmation…' : `Payer ${formatPrice(amount)}`}
      </Button>
    </form>
  );
}

export function CancelPayment({ publicId }: { publicId: string }) {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState('');
  const busy = useRef(false),
    router = useRouter();

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={async () => {
          if (busy.current) return;
          busy.current = true;
          setPending(true);

          try {
            const result = await cancelPaymentAction(publicId);
            setMessage(result.message);
            if (result.success) router.push('/checkout');
          } catch {
            setMessage('Impossible de vérifier l’annulation. Réessayez.');
          } finally {
            busy.current = false;
            setPending(false);
          }
        }}
      >
        {pending ? 'Vérification…' : 'Annuler cette tentative'}
      </Button>
      <p role="status">{message}</p>
    </div>
  );
}
