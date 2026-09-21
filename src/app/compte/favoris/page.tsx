import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import { requireCustomer } from '@/lib/auth/customer/session';
import { getWishlistProducts } from '@/lib/wishlist/data';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = {
  title: 'Mes favoris | Les Terres de Caldera',
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  const customer = await requireCustomer();
  const products = await getWishlistProducts(customer.id);

  return (
    <>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>MA SÉLECTION</p>
        <h1>Mes favoris</h1>
        <p>Retrouvez ici les pièces que vous souhaitez garder à l’œil.</p>
      </header>
      {products.length ? (
        <div className={styles.wishlistGrid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <section className={styles.card}>
          <h2>Votre sélection est vide</h2>
          <p>
            Ajoutez des produits à vos favoris depuis le catalogue pour les
            retrouver ici.
          </p>
          <div className={styles.actions}>
            <Link className={styles.button} href="/catalogue">
              Explorer le catalogue
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
