import Image from 'next/image';
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
 * Words only, no figures: the counts live with the products, below.
 */
export function CatalogueHero({
  breadcrumb,
  path,
  eyebrow,
  title,
  lead,
  range,
  explore,
}: {
  breadcrumb: BreadcrumbItem[];
  path: string;
  eyebrow: string;
  title: string;
  lead: string;
  /** What the counter holds: the licence, then the families with products. */
  range: readonly string[];
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
          {range.length > 0 && (
            <ul className={styles.range} aria-label="Au comptoir">
              {range.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {explore && (
            <Button href={explore} variant="gold" className={styles.explore}>
              Explorer le catalogue <ArrowDown aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
