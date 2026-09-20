'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckoutActionResult } from '@/lib/checkout/types';
export function useCheckoutAction() {
  const router = useRouter(),
    busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CheckoutActionResult | null>(null);
  function execute(
    action: () => Promise<CheckoutActionResult>,
    navigate = true,
  ) {
    if (busy.current || pending) return;
    busy.current = true;
    setResult(null);
    startTransition(async () => {
      try {
        const response = await action();
        setResult(response);
        if (response.success && response.next && navigate)
          router.push(`/checkout?step=${response.next}`);
      } catch {
        setResult({
          success: false,
          message:
            'Impossible de joindre le serveur. Vos dernières informations enregistrées sont conservées.',
        });
      } finally {
        busy.current = false;
      }
    });
  }
  return { execute, pending, result };
}
