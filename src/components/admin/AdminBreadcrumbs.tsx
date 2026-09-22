'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import styles from './Admin.module.scss';
const sections: Record<string, string> = {
  pilotage: 'Pilotage économique',
  produits: 'Produits',
  commandes: 'Commandes',
  stocks: 'Stocks',
  categories: 'Catégories',
  extensions: 'Extensions',
};
export function AdminBreadcrumbs() {
  const parts = usePathname().split('/').filter(Boolean);
  const section = sections[parts[1] ?? ''];
  const detail =
    parts[3] === 'bon-preparation'
      ? 'Bon de préparation'
      : parts[2] === 'nouveau'
        ? 'Nouveau produit'
        : parts[2]
          ? 'Détail'
          : null;
  return (
    <nav aria-label="Fil d’Ariane" className={styles.breadcrumb}>
      <Link href="/admin">Console</Link>
      <ChevronRight size={12} aria-hidden="true" />
      {section ? (
        <>
          {detail ? (
            <>
              <Link href={`/admin/${parts[1]}`}>{section}</Link>
              <ChevronRight size={12} aria-hidden="true" />
              <span aria-current="page">{detail}</span>
            </>
          ) : (
            <span aria-current="page">{section}</span>
          )}
        </>
      ) : (
        <span aria-current="page">Tableau de bord</span>
      )}
    </nav>
  );
}
