import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbListNode, breadcrumbTrail } from '@/lib/seo/jsonld';
import styles from './Breadcrumb.module.scss';
export type BreadcrumbItem = { label: string; href?: string };
export function Breadcrumb({
  items,
  currentPath,
  jsonLd = true,
}: {
  items: BreadcrumbItem[];
  /** Path of the current page, used for the last item of the BreadcrumbList. */
  currentPath?: string;
  /** Set to false when the page already puts the BreadcrumbList in its @graph. */
  jsonLd?: boolean;
}) {
  const structured = jsonLd
    ? breadcrumbListNode(breadcrumbTrail(items, currentPath))
    : null;
  return (
    <nav aria-label="Fil d’Ariane" className={styles.breadcrumb}>
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
      <JsonLd data={structured} />
    </nav>
  );
}
