'use client';
import { useEffect, useRef } from 'react';
import { synchronizeCheckoutAction } from '@/lib/checkout/actions';
export function CheckoutSync() {
  const busy = useRef(false),
    initialized = useRef(false);
  useEffect(() => {
    async function sync() {
      if (busy.current || document.visibilityState !== 'visible') return;
      busy.current = true;
      try {
        await synchronizeCheckoutAction();
      } catch {
        /* Page forms surface network errors when used. */
      } finally {
        busy.current = false;
      }
    }
    if (!initialized.current) {
      initialized.current = true;
      void sync();
    }
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);
  return null;
}
