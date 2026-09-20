import styles from './ProductDetails.module.scss';
export function ProductDetails({
  description,
  tags,
}: {
  description: string | null;
  tags: { name: string; slug: string }[];
}) {
  if (!description?.trim() && !tags.length) return null;
  return (
    <section className={styles.details} aria-label="À propos de ce produit">
      {description?.trim() && (
        <>
          <h2>Description</h2>
          <p>{description}</p>
        </>
      )}
      {tags.length > 0 && (
        <ul aria-label="Étiquettes du produit">
          {tags.slice(0, 4).map((tag) => (
            <li key={tag.slug}>{tag.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
