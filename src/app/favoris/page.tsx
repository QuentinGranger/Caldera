import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import { WishlistPageSkeleton } from '@/components/loading/LoadingSkeleton';
import { Container } from '@/components/ui/Container/Container';
import { getWishlistProducts, getWishlistSnapshot } from '@/lib/wishlist/data';
import { ALL_PRODUCTS_LABEL } from '@/lib/ux/copy';
import styles from './wishlist.module.scss';

export const metadata: Metadata = {
  title: 'Mes favoris',
  description: 'Retrouvez votre sélection de produits préférés.',
  robots: { index: false, follow: false },
};

async function WishlistContent() {
  const snapshot = await getWishlistSnapshot();
  const { products, readError } = await getWishlistProducts(snapshot);

  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <header className={styles.header}>
          <p className={styles.eyebrow}>MA SÉLECTION</p>
          <h1>Mes favoris</h1>
          <p>
            {snapshot.authenticated ? (
              'Votre sélection est enregistrée dans votre compte.'
            ) : (
              <>
                Votre sélection est conservée pendant cette session.{' '}
                <Link href="/compte/connexion?retour=%2Ffavoris">
                  Connectez-vous
                </Link>{' '}
                pour la retrouver dans votre compte.
              </>
            )}
          </p>
        </header>
        {readError ? (
          <section className={styles.empty}>
            <Heart size={34} strokeWidth={1.4} aria-hidden="true" />
            <h2>Vos favoris sont momentanément indisponibles</h2>
            <p>
              Réessayez dans quelques instants : votre sélection est conservée.
            </p>
            <Link href="/favoris">Réessayer</Link>
          </section>
        ) : products.length ? (
          <div className={styles.grid}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <section className={styles.empty}>
            <Heart size={34} strokeWidth={1.4} aria-hidden="true" />
            <h2>Votre sélection est vide</h2>
            <p>
              Touchez le cœur d’un produit pour le garder ici et le retrouver
              facilement.
            </p>
            <Link href="/catalogue">{ALL_PRODUCTS_LABEL}</Link>
          </section>
        )}
      </Container>
    </main>
  );
}

export default function WishlistPage() {
  return (
    <Suspense fallback={<WishlistPageSkeleton />}>
      <WishlistContent />
    </Suspense>
  );
}
