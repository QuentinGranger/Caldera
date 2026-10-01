'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import {
  BarChart3,
  Boxes,
  Dices,
  FileText,
  FolderTree,
  Landmark,
  Layers3,
  LayoutDashboard,
  Mail,
  Menu,
  Package,
  PackageOpen,
  ShoppingBag,
  TicketPercent,
  Warehouse,
  X,
} from 'lucide-react';
import styles from './Admin.module.scss';

const groups = [
  {
    label: 'Pilotage',
    links: [
      { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
      {
        href: '/admin/pilotage',
        label: 'Pilotage économique',
        icon: BarChart3,
      },
    ],
  },
  {
    label: 'Catalogue',
    links: [
      { href: '/admin/jeux', label: 'Jeux', icon: Dices },
      { href: '/admin/categories', label: 'Catégories', icon: FolderTree },
      { href: '/admin/extensions', label: 'Extensions', icon: Layers3 },
      { href: '/admin/produits', label: 'Produits', icon: Package },
    ],
  },
  {
    label: 'Approvisionnement',
    links: [
      { href: '/admin/fournisseurs', label: 'Fournisseurs', icon: Warehouse },
      { href: '/admin/stocks', label: 'Stocks', icon: Boxes },
    ],
  },
  {
    label: 'Ventes',
    links: [
      { href: '/admin/commandes', label: 'Commandes', icon: ShoppingBag },
      { href: '/admin/retours', label: 'Retours', icon: PackageOpen },
    ],
  },
  {
    label: 'Marketing',
    links: [
      {
        href: '/admin/promotions',
        label: 'Codes promo',
        icon: TicketPercent,
      },
      { href: '/admin/newsletter', label: 'Newsletter', icon: Mail },
    ],
  },
  {
    label: 'Comptabilité',
    links: [
      { href: '/admin/factures', label: 'Factures', icon: FileText },
      { href: '/admin/fiscalite', label: 'Fiscalité', icon: Landmark },
    ],
  },
] as const;

export function AdminNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);

  const navigation = (
    <nav aria-label="Administration" className={styles.navigation}>
      {groups.map((group) => (
        <div key={group.label} className={styles.navGroup}>
          <p>{group.label}</p>
          {group.links.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== '/admin' && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                className={styles.navLink}
                aria-current={active ? 'page' : undefined}
                onClick={() => dialog.current?.close()}
              >
                <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                <span>{label}</span>
                {active && (
                  <i className={styles.navActive} aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  if (!mobile) return navigation;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`${styles.mobileButton} ${styles.secondaryButton}`}
        aria-label="Ouvrir la navigation admin"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <dialog
        id={id}
        ref={dialog}
        className={`${styles.dialog} ${styles.mobileNav}`}
        aria-label="Navigation administration"
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
      >
        <div className={styles.panelHeader}>
          <strong>CALDERA / ADMIN</strong>
          <button
            type="button"
            className={styles.quietButton}
            aria-label="Fermer la navigation"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {navigation}
      </dialog>
    </>
  );
}
