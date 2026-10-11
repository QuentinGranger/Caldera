import type { ReactNode } from 'react';
import Link from 'next/link';
import { Compass, LogOut } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/auth';
import { logoutAction } from '@/lib/admin/actions';
import { countOrdersToHandle } from '@/lib/admin/queries';
import { countOpenReturns } from '@/lib/returns/admin';
import { countOpenMessages } from '@/lib/admin/messages';
import { AdminNavigation } from '@/components/admin/AdminNavigation';
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs';
import { AdminAccountMenu } from '@/components/admin/AdminAccountMenu';
import { AdminQuickAccess } from '@/components/admin/AdminQuickAccess';
import styles from '@/components/admin/Admin.module.scss';
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [admin, orders, returns, messages] = await Promise.all([
    requireAdmin(),
    countOrdersToHandle(),
    countOpenReturns(),
    countOpenMessages(),
  ]);
  // What waits for the shop, beside the menu entries that hold it.
  const counts = {
    '/admin/commandes': orders,
    '/admin/retours': returns,
    '/admin/messages': messages,
  };
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link
          href="/admin"
          className={styles.brand}
          aria-label="Caldera — Tableau de bord"
        >
          <span className={styles.brandIcon}>
            <Compass size={27} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span>
            <strong>CALDERA</strong>
            <small>Administration</small>
          </span>
        </Link>
        <AdminNavigation counts={counts} />
        <div className={styles.sidebarFoot}>
          <p>LES TERRES DE CALDERA</p>
          <span>Votre boutique, aux commandes.</span>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <AdminNavigation mobile counts={counts} />
            <AdminBreadcrumbs />
          </div>
          <AdminQuickAccess />
          <AdminAccountMenu name={admin.name} email={admin.email}>
            <form action={logoutAction}>
              <button type="submit" className={styles.quietButton}>
                <LogOut size={16} aria-hidden="true" />
                Se déconnecter
              </button>
            </form>
          </AdminAccountMenu>
        </header>
        <main id="contenu" className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
