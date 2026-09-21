import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutCustomerAction } from '@/lib/auth/customer/actions';
import type { CustomerView } from '@/lib/auth/customer/session';
import styles from './Account.module.scss';

export function AccountShell({
  customer,
  children,
}: {
  customer: CustomerView;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <p className={styles.eyebrow}>Espace personnel</p>
        <h2 className={styles.sidebarTitle}>Bonjour {customer.firstName}</h2>
        <nav aria-label="Navigation du compte">
          <Link href="/compte">Vue d’ensemble</Link>
          <Link href="/compte/profil">Profil</Link>
          <Link href="/compte/commandes">Commandes</Link>
          <Link href="/compte/favoris">Favoris</Link>
          <Link href="/compte/adresses">Adresses</Link>
          <Link href="/compte/securite">Sécurité</Link>
          <form action={logoutCustomerAction}>
            <button type="submit">Se déconnecter</button>
          </form>
        </nav>
      </aside>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
