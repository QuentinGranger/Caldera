'use client';
import { useEffect } from 'react';
import {
  analyticsAllowed,
  trackCommerce,
  type CommerceEvent as EventName,
  type CommerceItem,
} from '@/lib/analytics/client';
export function CommerceEvent({
  name,
  items,
  value,
  transactionId,
  shipping,
  tax,
}: {
  name: EventName;
  items: CommerceItem[];
  value: number;
  transactionId?: string;
  shipping?: number;
  tax?: number;
}) {
  useEffect(() => {
    let sent = false;
    function send() {
      if (sent || !analyticsAllowed()) return;
      const target = window as unknown as { gtag?: unknown };
      if (!target.gtag) return;
      const key = transactionId
        ? `caldera-measured-order-${transactionId}`
        : null;
      try {
        if (key && sessionStorage.getItem(key)) return;
      } catch {}
      trackCommerce(name, {
        items,
        value,
        ...(transactionId
          ? { transaction_id: transactionId, shipping, tax }
          : {}),
      });
      sent = true;
      try {
        if (key) sessionStorage.setItem(key, '1');
      } catch {}
    }
    send();
    window.addEventListener('caldera:analytics-ready', send);
    return () => window.removeEventListener('caldera:analytics-ready', send);
  }, [name, items, value, transactionId, shipping, tax]);
  return null;
}
