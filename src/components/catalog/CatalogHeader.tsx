import styles from './Catalog.module.scss';
export function CatalogHeader({
  title,
  description,
  total,
}: {
  title: string;
  description?: string | null;
  total: number;
}) {
  return (
    <header className={styles.heading}>
      <p className={styles.eyebrow}>Les territoires de la collection</p>
      <h1>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
      <p className={styles.count}>
        {total} {total > 1 ? 'produits' : 'produit'}
      </p>
    </header>
  );
}
