'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button/Button';
export function OrderStatusRefresh({
  publicId,
  status,
}: {
  publicId: string;
  status: string;
}) {
  const router = useRouter(),
    [waiting, setWaiting] = useState(true);
  useEffect(() => {
    let stopped = false,
      timer: ReturnType<typeof setTimeout>,
      count = 0;
    async function poll() {
      try {
        const response = await fetch(`/api/commande/${publicId}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          setWaiting(false);
          return;
        }
        const value: { status?: string } = await response.json();
        if (!stopped && value.status !== status) {
          router.refresh();
          return;
        }
      } catch {
        /* A bounded retry tolerates transient network failures. */
      }
      if (!stopped && ++count < 20) timer = setTimeout(poll, 3000);
      else if (!stopped) setWaiting(false);
    }
    timer = setTimeout(poll, 3000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [publicId, router, status]);
  return (
    <div>
      <p role="status">
        {waiting
          ? 'Vérification automatique du statut pendant une minute…'
          : 'La confirmation peut prendre plus de temps. Vous pouvez actualiser le statut.'}
      </p>
      <Button variant="outline" onClick={() => router.refresh()}>
        Actualiser le statut
      </Button>
    </div>
  );
}
