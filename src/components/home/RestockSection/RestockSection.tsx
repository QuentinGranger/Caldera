import { Container } from '@/components/ui/Container/Container';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import type { CatalogProduct } from '@/types/product';
import styles from './RestockSection.module.scss';
export function RestockSection({ products }: { products: CatalogProduct[] }) {
  return (
    <section
      id="reassorts"
      className={styles.section}
      aria-labelledby="restock-title"
    >
      <Container>
        <SectionTitle
          id="restock-title"
          eyebrow="Une nouvelle occasion de les découvrir"
          title="De retour sur les terres"
          link={{
            href: '#newsletter',
            label: 'Suivre les prochaines découvertes',
          }}
        />
        <div className={styles.grid}>
          {products.length === 0 && (
            <p>Aucun réassort disponible pour le moment.</p>
          )}
          {products.map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
      </Container>
    </section>
  );
}
