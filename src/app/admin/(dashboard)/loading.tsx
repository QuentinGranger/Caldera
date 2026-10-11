import styles from '@/components/admin/Admin.module.scss';

export default function AdminLoading() {
  return (
    <section
      className={styles.loadingView}
      aria-busy="true"
      aria-label="Chargement de la page"
    >
      <p role="status">Chargement de votre espace…</p>
      <div aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
