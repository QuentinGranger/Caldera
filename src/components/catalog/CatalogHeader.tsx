import type { ReactNode } from 'react';
import styles from './Catalog.module.scss';
export function CatalogHeader({
  title,
  description,
  intro,
  total,
  eyebrow = 'Les territoires de la collection',
}: {
  title: string;
  description?: string | null;
  /** Factual paragraphs under the title, links included. */
  intro?: ReactNode;
  /** Product count line; left out when the intro already states it. */
  total?: number;
  eyebrow?: string;
}) {
  return (
    <header className={styles.heading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
      {intro && <div className={styles.intro}>{intro}</div>}
      {total !== undefined && (
        <p className={styles.count}>
          {total} {total > 1 ? 'produits' : 'produit'}
        </p>
      )}
    </header>
  );
}
