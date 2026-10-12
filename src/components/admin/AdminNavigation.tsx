'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
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
import { AdminLogo } from './AdminLogo';
import styles from './Admin.module.scss';

export const adminNavGroups = [
  {
    label: 'Au quotidien',
    links: [
      { href: '/admin', label: 'Vue d’ensemble', icon: LayoutDashboard },
      { href: '/admin/commandes', label: 'Commandes', icon: ShoppingBag },
      { href: '/admin/produits', label: 'Produits', icon: Package },
      { href: '/admin/stocks', label: 'Stocks', icon: Boxes },
      { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
    ],
  },
  {
    label: 'Catalogue',
    links: [
      {
        href: '/admin/categories',
        label: 'Familles & catégories',
        icon: FolderTree,
      },
      { href: '/admin/extensions', label: 'Extensions', icon: Layers3 },
      { href: '/admin/jeux', label: 'Jeux & FAQ', icon: Dices },
      {
        href: '/admin/fournisseurs',
        label: 'Fournisseurs & imports',
        icon: Warehouse,
      },
    ],
  },
  {
    label: 'Ventes & clients',
    links: [
      { href: '/admin/retours', label: 'Retours', icon: PackageOpen },
      { href: '/admin/clients', label: 'Clients', icon: Users },
      { href: '/admin/livraison', label: 'Livraison', icon: Truck },
    ],
  },
  {
    label: 'Communication',
    links: [
      { href: '/admin/newsletter', label: 'Emails & newsletter', icon: Mail },
      { href: '/admin/discord', label: 'Discord', icon: MessageSquare },
      { href: '/admin/promotions', label: 'Codes promo', icon: TicketPercent },
    ],
  },
  {
    label: 'Analyses & finances',
    links: [
      {
        href: '/admin/mesures',
        label: 'Trafic & conversions',
        icon: BarChart3,
      },
      {
        href: '/admin/pilotage',
        label: 'Pilotage économique',
        icon: BarChart3,
      },
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

  const isActive = (href: string) =>
    pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));

  function entry({
    href,
    label,
    icon: Icon,
  }: (typeof adminNavGroups)[number]['links'][number]) {
    const count = counts[href] ?? 0;
    const [one, many] = COUNT_LABELS[href] ?? ['en attente', 'en attente'];
    return (
      <Link
        key={href}
        href={href}
        className={styles.navLink}
        aria-current={isActive(href) ? 'page' : undefined}
        onClick={() => dialog.current?.close()}
      >
        <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
        <span>{label}</span>
        {count > 0 && (
          <b className={styles.navCount}>
            {count > 99 ? '99+' : count}
            <span
              className={styles.visuallyHidden}
            >{` ${count > 1 ? many : one}`}</span>
          </b>
        )}
      </Link>
    );
  }

  const navigation = (
    <nav aria-label="Administration" className={styles.navigation}>
      <div className={styles.navGroup}>
        <p>Au quotidien</p>
        {adminNavGroups[0].links.map(entry)}
      </div>
      <div className={styles.navGroup}>
        <p>Vos espaces</p>
        {adminNavGroups.slice(1, -1).map((group) => {
          const active = group.links.some(({ href }) => isActive(href));
          const count = group.links.reduce(
            (n, { href }) => n + (counts[href] ?? 0),
            0,
          );
          const Icon = group.links[0].icon;
          return (
            <details
              key={`${group.label}-${active}`}
              open={active}
              className={styles.navDisclosure}
              data-active={active || undefined}
            >
              <summary>
                <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                <span>{group.label}</span>
                {count > 0 && (
                  <b className={styles.navCount}>
                    {count > 99 ? '99+' : count}
                    <span className={styles.visuallyHidden}>
                      {' '}
                      éléments à traiter
                    </span>
                  </b>
                )}
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className={styles.navChildren}>{group.links.map(entry)}</div>
            </details>
          );
        })}
      </div>
      <div className={styles.navSettings}>
        {adminNavGroups[5].links.map(entry)}
      </div>
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
          <div className={styles.mobileBrand}>
            <AdminLogo />
          </div>
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
