'use client';
import { useEffect, useRef } from 'react';
import {
  analyticsAllowed,
  measureLocal,
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
  const localEvent = useRef<string | null>(null);
  const sentEvent = useRef<string | null>(null);
  const eventKey = JSON.stringify({
    name,
    items,
    value,
    transactionId,
    shipping,
    tax,
  });
  useEffect(() => {
    function send() {
      if (sentEvent.current === eventKey || !analyticsAllowed()) return;
      if (localEvent.current !== eventKey) {
        measureLocal(
          name,
          name === 'view_item' ? { variantId: items[0]?.item_id } : {},
        );
        localEvent.current = eventKey;
      }
      const target = window as unknown as { gtag?: unknown };
      if (!target.gtag) return;
      const key = transactionId
        ? `caldera-measured-order-${transactionId}`
        : null;
      try {
        if (key && sessionStorage.getItem(key)) return;
      } catch {}
      trackCommerce(
        name,
        {
          items,
          value,
          ...(transactionId
            ? { transaction_id: transactionId, shipping, tax }
            : {}),
        },
        false,
      );
      sentEvent.current = eventKey;
      try {
        if (key) sessionStorage.setItem(key, '1');
      } catch {}
    }
    send();
    window.addEventListener('caldera:analytics-ready', send);
    window.addEventListener('caldera:consent-changed', send);
    return () => {
      window.removeEventListener('caldera:analytics-ready', send);
      window.removeEventListener('caldera:consent-changed', send);
    };
  }, [eventKey, name, items, value, transactionId, shipping, tax]);
  return null;
}
