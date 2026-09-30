'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { ocrStepAction } from '@/lib/supplier-import/admin-actions';
import styles from './Admin.module.scss';
import local from './SupplierImport.module.scss';

/**
 * Scanned pages are read a few at a time (each request stays within the
 * host's time limit); this page drives the loop while it stays open.
 */
export function OcrProgress({
  importId,
  total,
  pending,
}: {
  importId: string;
  total: number;
  pending: number;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(pending);
  const [error, setError] = useState<string | null>(null);
  // Bumped by « Reprendre »: the effect below starts the loop again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function loop() {
      for (;;) {
        const result = await ocrStepAction(importId);
        if (!active) return;
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setRemaining(result.remaining);
        if (!result.remaining) {
          router.refresh();
          return;
        }
      }
    }
    loop().catch(() => {
      if (active)
        setError('Lecture interrompue : vérifiez la connexion puis reprenez.');
    });
    return () => {
      active = false;
    };
  }, [importId, router, attempt]);

  return (
    <div className={local.progress} role="status">
      <span>
        Lecture OCR des pages scannées : {total - remaining} sur {total}. Gardez
        cette page ouverte.
      </span>
      <progress max={total} value={total - remaining} />
      {error && (
        <p role="alert" className={`${styles.message} ${styles.error}`}>
          <CircleAlert size={17} aria-hidden="true" />
          {error}{' '}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Reprendre
          </button>
        </p>
      )}
    </div>
  );
}
