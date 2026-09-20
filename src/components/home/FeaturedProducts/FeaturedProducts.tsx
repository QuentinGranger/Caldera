import { Compass, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container/Container';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import type { CatalogProduct } from '@/types/product';
import styles from './FeaturedProducts.module.scss';
type Props = { products: CatalogProduct[]; editorial?: boolean };
export function FeaturedProducts({ products, editorial = false }: Props) {
  if (editorial)
    return (
      <section
        id="selection"
        className={styles.selection}
        aria-labelledby="selection-title"
      >
        <Container className={styles.selectionGrid}>
          <div className={styles.story}>
            <Compass size={38} strokeWidth={1} aria-hidden="true" />
            <p className={styles.eyebrow}>Le regard du collectionneur</p>
            <h2 id="selection-title">
              Les trésors
              <br />
              de Caldera.
            </h2>
            <p>
              Il y a des pièces que l’on cherche.
              <br />
              Et celles qui nous trouvent.
            </p>
            <p>
              Notre sélection fait la part belle aux illustrations singulières
              et aux coffrets qui racontent une histoire.
            </p>
            <Link href="#univers">
              L’esprit de notre sélection{' '}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.curated}>
            {products.length === 0 && (
              <p>La sélection sera bientôt disponible.</p>
            )}
            {products.map((product) => (
              <div className={styles.curatedCard} key={product.id}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </Container>
      </section>
    );
  return (
    <section
      id="nouveautes"
      className={styles.section}
      aria-labelledby="new-title"
    >
      <Container>
        <SectionTitle
          id="new-title"
          eyebrow="De nouvelles découvertes"
          title="Nouveautés"
          link={{ href: '/nouveautes', label: 'Toutes les nouveautés' }}
        />
        <div className={styles.grid}>
          {products.length === 0 && (
            <p>Aucune nouveauté publiée pour le moment.</p>
          )}
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <p className={styles.demo}>
          Aperçu de la boutique · Produits, prix et disponibilités présentés à
          titre de démonstration.
        </p>
      </Container>
    </section>
  );
}
