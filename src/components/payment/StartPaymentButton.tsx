'use client';
import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button/Button';
import { startPaymentAction } from '@/lib/payments/actions';
export function StartPaymentButton({
  sessionId,
  disabled,
}: {
  sessionId: string;
  disabled: boolean;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState('');
  const busy = useRef(false),
    router = useRouter();
  return (
    <>
      <Button
        disabled={disabled || pending}
        onClick={() => {
          if (busy.current) return;
          busy.current = true;
          start(async () => {
            try {
              const result = await startPaymentAction(sessionId);
              setMessage(result.message);
              if (result.success) router.push(result.href);
            } catch {
              setMessage(
                'Connexion interrompue. Réessayez pour retrouver votre tentative.',
              );
            } finally {
              busy.current = false;
            }
          });
        }}
      >
        {pending ? 'Réservation en cours…' : 'Continuer vers le paiement'}
      </Button>
      <p role="status">{message}</p>
    </>
  );
}
