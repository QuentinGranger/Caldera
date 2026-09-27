'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { signOutAction } from '@/lib/account/actions';
import styles from './Account.module.scss';

const LINKS = [
  { href: '/compte', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/compte/commandes', label: 'Mes commandes', icon: Package },
  { href: '/compte/adresse', label: 'Adresse de livraison', icon: MapPin },
  { href: '/compte/profil', label: 'Profil et sécurité', icon: ShieldCheck },
];

/** Who is signed in, the account sections and sign-out. */
export function AccountNav({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('fr'))
    .join('');
  return (
    <aside className={styles.sidebar}>
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">
          {initials || '?'}
        </span>
        <div>
          <p className={styles.identityName}>{name}</p>
          <p className={styles.identityEmail}>{email}</p>
        </div>
      </div>
      <nav aria-label="Mon compte" className={styles.accountNav}>
        <ul>
          {LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={pathname === href ? 'page' : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
          <li>
            <form action={signOutAction}>
              <button type="submit" className={styles.signOut}>
                <LogOut size={18} aria-hidden="true" />
                Se déconnecter
              </button>
            </form>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
