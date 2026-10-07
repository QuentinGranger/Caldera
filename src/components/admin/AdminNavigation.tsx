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
  MessageSquare,
  Package,
  PackageOpen,
  ShieldCheck,
  ShoppingBag,
  TicketPercent,
  Truck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import styles from './Admin.module.scss';

export const adminNavGroups = [
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
    label: 'Ventes',
    links: [
      { href: '/admin/commandes', label: 'Commandes', icon: ShoppingBag },
      { href: '/admin/retours', label: 'Retours', icon: PackageOpen },
      { href: '/admin/clients', label: 'Clients', icon: Users },
      { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
      { href: '/admin/livraison', label: 'Livraison', icon: Truck },
    ],
  },
  {
    label: 'Catalogue',
    links: [
      { href: '/admin/produits', label: 'Produits', icon: Package },
      { href: '/admin/jeux', label: 'Jeux', icon: Dices },
      { href: '/admin/categories', label: 'Catégories', icon: FolderTree },
      { href: '/admin/extensions', label: 'Extensions', icon: Layers3 },
    ],
  },
  {
    label: 'Approvisionnement',
    links: [
      { href: '/admin/stocks', label: 'Stocks', icon: Boxes },
      { href: '/admin/fournisseurs', label: 'Fournisseurs', icon: Warehouse },
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
      { href: '/admin/discord', label: 'Discord', icon: MessageSquare },
    ],
  },
  {
    label: 'Comptabilité',
    links: [
      { href: '/admin/factures', label: 'Factures', icon: FileText },
      { href: '/admin/fiscalite', label: 'Fiscalité', icon: Landmark },
    ],
  },
  {
    label: 'Compte',
    links: [
      {
        href: '/admin/securite',
        label: 'Sécurité du compte',
        icon: ShieldCheck,
      },
    ],
  },
] as const;

/** Items waiting for the shop, by menu entry (absent or 0: no badge). */
export type AdminNavCounts = Partial<Record<string, number>>;
const COUNT_LABELS: Record<string, [string, string]> = {
  '/admin/commandes': ['commande à traiter', 'commandes à traiter'],
  '/admin/retours': ['retour à traiter', 'retours à traiter'],
  '/admin/messages': ['message à traiter', 'messages à traiter'],
};

export function AdminNavigation({
  mobile = false,
  counts = {},
}: {
  mobile?: boolean;
  counts?: AdminNavCounts;
}) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);

  const navigation = (
    <nav aria-label="Administration" className={styles.navigation}>
      {adminNavGroups.map((group) => (
        <div key={group.label} className={styles.navGroup}>
          <p>{group.label}</p>
          {group.links.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== '/admin' && pathname.startsWith(`${href}/`));
            const count = counts[href] ?? 0;
            const [one, many] = COUNT_LABELS[href] ?? [
              'en attente',
              'en attente',
            ];
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
                {count > 0 && (
                  <b className={styles.navCount}>
                    {count > 99 ? '99+' : count}
                    <span className={styles.visuallyHidden}>
                      {` ${count > 1 ? many : one}`}
                    </span>
                  </b>
                )}
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
