'use client';

import { useId, useState, type ReactNode } from 'react';
import { ArrowDownUp, ClipboardList } from 'lucide-react';
import styles from './Admin.module.scss';

export function StockAdjustmentPanel({
  adjustment,
  correction,
}: {
  adjustment: ReactNode;
  correction: ReactNode;
}) {
  const [mode, setMode] = useState<'delta' | 'absolute'>('delta');
  const id = useId();
  return (
    <>
      <div
        className={styles.stockModes}
        aria-label="Type d’opération sur le stock"
      >
        <button
          type="button"
          aria-pressed={mode === 'delta'}
          aria-controls={`${id}-delta`}
          onClick={() => setMode('delta')}
        >
          <ArrowDownUp size={18} aria-hidden="true" /> Ajouter / retirer
        </button>
        <button
          type="button"
          aria-pressed={mode === 'absolute'}
          aria-controls={`${id}-absolute`}
          onClick={() => setMode('absolute')}
        >
          <ClipboardList size={18} aria-hidden="true" /> Corriger un comptage
        </button>
      </div>
      <div id={`${id}-delta`} hidden={mode !== 'delta'}>
        <p className={styles.stockOperationHint}>
          Enregistrez une réception, un retour, une perte ou un dommage. Une
          quantité négative retire des unités.
        </p>
        {adjustment}
      </div>
      <div id={`${id}-absolute`} hidden={mode !== 'absolute'}>
        <p className={styles.stockOperationHint}>
          Indiquez le nombre total d’unités comptées. Les réservations clients
          restent protégées.
        </p>
        {correction}
      </div>
    </>
  );
}
