'use client';
import { useState } from 'react';
import styles from './Admin.module.scss';
import { Copy } from 'lucide-react';
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState('');
  return (
    <>
      <button
        type="button"
        className={styles.quietButton}
        aria-label={`Copier ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage('Copié.');
          } catch {
            setMessage('Copie impossible. Sélectionnez le texte.');
          }
        }}
      >
        <Copy size={15} aria-hidden="true" />
        Copier
      </button>
      <small role="status">{message}</small>
    </>
  );
}
