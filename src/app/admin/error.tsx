'use client';
import styles from '@/components/admin/Admin.module.scss';
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main id="contenu" className={styles.content}>
      <div className={styles.card}>
        <h1>Administration indisponible</h1>
        <p>Impossible de charger ces données. Réessayez dans un instant.</p>
        <button type="button" onClick={reset}>
          Réessayer
        </button>
      </div>
    </main>
  );
}
