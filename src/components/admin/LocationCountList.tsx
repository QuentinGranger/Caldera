'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import { recordPhysicalCountAction } from '@/lib/admin/inventory-count-actions';
import styles from './Admin.module.scss';

type Row = {
  id: string;
  sku: string;
  location: string | null;
  expected: number;
  version: string;
  counted: number | null;
  detailHref: string;
};

export function LocationCountList({
  rows,
  nextPage,
}: {
  rows: Row[];
  nextPage?: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState(rows[0]?.id);
  const [feedback, setFeedback] = useState({
    id: '',
    message: '',
    error: false,
  });
  const [pending, startTransition] = useTransition();
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash === '#premier-comptage') {
      list.current?.querySelector('input')?.focus();
    }
  }, []);

  useEffect(() => {
    const input = document.activeElement;
    if (input instanceof HTMLInputElement && list.current?.contains(input)) {
      input.form?.scrollIntoView({ block: 'nearest' });
    }
  }, [active]);

  function save(row: Row, index: number, data: FormData) {
    if (pending) return;
    const quantity = Number(data.get('quantity'));
    startTransition(async () => {
      try {
        const result = await recordPhysicalCountAction(
          { success: false, message: '' },
          data,
        );
        if (!result.success) {
          setFeedback({ id: row.id, message: result.message, error: true });
          return;
        }
        const next = rows[index + 1];
        const difference = quantity - row.expected;
        const message = difference
          ? `${row.sku} enregistré. Écart de ${difference > 0 ? '+' : ''}${difference} à examiner.`
          : `${row.sku} enregistré. Comptage concordant.`;
        setFeedback({
          id: row.id,
          message:
            message +
            (!next && !nextPage ? ' Dernière référence atteinte.' : ''),
          error: false,
        });
        if (next) {
          document.getElementById(`quantite-${next.id}`)?.focus();
        } else if (nextPage) {
          router.push(nextPage + '#premier-comptage');
        }
      } catch {
        setFeedback({
          id: row.id,
          message:
            'Enregistrement impossible. Vérifiez la connexion et réessayez.',
          error: true,
        });
      }
    });
  }

  return (
    <div className={styles.countList} ref={list} id="premier-comptage">
      {rows.map((row, index) => (
        <Fragment key={row.id}>
          {(index === 0 || row.location !== rows[index - 1]?.location) && (
            <h2>{row.location ?? 'Sans emplacement'}</h2>
          )}
          <form
            aria-label={`Compter ${row.sku}`}
            onSubmit={(event) => {
              event.preventDefault();
              save(row, index, new FormData(event.currentTarget));
            }}
          >
            <div className={styles.countLine}>
              <div>
                <small>SKU</small>
                <code>{row.sku}</code>
              </div>
              <div>
                <small>Attendu</small>
                <strong>{row.expected}</strong>
              </div>
              <label>
                Compté
                <input
                  key={row.version}
                  id={`quantite-${row.id}`}
                  name="quantity"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1000000}
                  step={1}
                  required
                  aria-label={`Quantité comptée pour ${row.sku}`}
                  readOnly={pending && active === row.id}
                  onFocus={() => setActive(row.id)}
                />
              </label>
            </div>
            <input type="hidden" name="variantId" value={row.id} />
            <input type="hidden" name="expectedVersion" value={row.version} />
            {row.counted !== null && (
              <small>
                Dernier comptage : {row.counted}
                {row.counted !== row.expected && (
                  <>
                    {' '}
                    ·{' '}
                    <Link href={row.detailHref}>
                      Examiner l’écart pour {row.sku}
                    </Link>
                  </>
                )}
              </small>
            )}
            {active === row.id && (
              <button type="submit" disabled={pending}>
                {pending
                  ? 'Enregistrement…'
                  : 'Enregistrer et passer au suivant'}
              </button>
            )}
            {feedback.id === row.id && (
              <p role={feedback.error ? 'alert' : 'status'}>
                {feedback.message}
              </p>
            )}
          </form>
        </Fragment>
      ))}
    </div>
  );
}
