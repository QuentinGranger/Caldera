import type { ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink, Gamepad2, LogOut } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/auth';
import { logoutAction } from '@/lib/admin/actions';
import { AdminNavigation } from '@/components/admin/AdminNavigation';
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs';
import styles from '@/components/admin/Admin.module.scss';
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await requireAdmin();
  const initials = admin.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link
          href="/admin"
          className={styles.brand}
          aria-label="Caldera — Tableau de bord"
        >
          <span className={styles.brandIcon}>
            <Gamepad2 size={27} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span>
            <strong>CALDERA</strong>
            <small>CONTROL ROOM</small>
          </span>
        </Link>
        <AdminNavigation />
        <div className={styles.sidebarFoot}>
          <p>LES TERRES DE CALDERA</p>
          <span>Votre boutique, aux commandes.</span>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <AdminNavigation mobile />
            <AdminBreadcrumbs />
          </div>
          <div className={styles.userMenu}>
            <Link
              href="/"
              className={`${styles.button} ${styles.secondaryButton}`}
              aria-label="Voir la boutique"
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span className={styles.buttonLabel}>Voir la boutique</span>
            </Link>
            <span className={styles.avatar} aria-hidden="true">
              {initials}
            </span>
            <div className={styles.userInfo}>
              <strong>{admin.name}</strong>
              <small>{admin.email}</small>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className={styles.quietButton}
                aria-label="Se déconnecter"
                title="Se déconnecter"
              >
                <LogOut size={17} aria-hidden="true" />
              </button>
            </form>
          </div>
        </header>
        <main id="contenu" className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
