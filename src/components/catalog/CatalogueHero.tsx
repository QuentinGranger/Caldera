import Image from 'next/image';
import type { ReactNode } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import {
  Breadcrumb,
  type BreadcrumbItem,
} from '@/components/ui/Breadcrumb/Breadcrumb';
import styles from './CatalogueHero.module.scss';

/**
 * The entrance of the catalogue: a view over Caldera, kept short (the shop
 * is right below), that settles into the counter where the products are.
 */
export function CatalogueHero({
  breadcrumb,
  path,
  eyebrow,
  title,
  lead,
  facts,
  explore,
}: {
  breadcrumb: BreadcrumbItem[];
  path: string;
  eyebrow: string;
  title: string;
  lead: string;
  /** Factual lines (counts, prices, games), links included. */
  facts?: ReactNode;
  /** Anchor of the products, absent while there is none. */
  explore?: string;
}) {
  return (
    <section className={styles.hero} aria-labelledby="catalogue-title">
      <div className={styles.media} aria-hidden="true">
        <Image
          src="/assets/images/ArchiveExplorateurs.png"
          alt=""
          fill
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
        />
      </div>
      <div className={styles.inner}>
        <Breadcrumb items={breadcrumb} currentPath={path} />
        <div className={styles.content}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 id="catalogue-title">{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {facts && <div className={styles.facts}>{facts}</div>}
          {explore && (
            <Button href={explore} variant="gold" className={styles.explore}>
              Explorer les produits <ArrowDown aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
