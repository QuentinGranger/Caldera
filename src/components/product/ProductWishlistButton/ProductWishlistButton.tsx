'use client';

import { Heart } from 'lucide-react';
import { useWishlist } from '@/components/wishlist/WishlistProvider';
import styles from './ProductWishlistButton.module.scss';

export function ProductWishlistButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const { isFavorite, isPending, toggle } = useWishlist();
  const favorite = isFavorite(productId);
  const pending = isPending(productId);
  return (
    <button
      type="button"
      className={`${styles.button} ${favorite ? styles.active : ''}`}
      aria-label={`${pending ? 'Enregistrement…' : favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${productName}`}
      aria-pressed={favorite}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={() => toggle(productId)}
    >
      <Heart size={18} aria-hidden="true" />
      {pending
        ? 'Enregistrement…'
        : favorite
          ? 'Retirer des favoris'
          : 'Ajouter aux favoris'}
    </button>
  );
}
