'use client';

import { Heart } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { useWishlist } from '@/components/wishlist/WishlistProvider';
import styles from './ProductFavorite.module.scss';

export function ProductFavorite({
  productId,
  productName,
  className = '',
}: {
  productId: string;
  productName: string;
  className?: string;
}) {
  const { authenticated, isFavorite, isPending, toggle } = useWishlist();
  if (!authenticated) return null;

  const favorite = isFavorite(productId);
  const pending = isPending(productId);
  const action = favorite ? 'Retirer' : 'Ajouter';

  return (
    <IconButton
      className={`${className} ${favorite ? styles.active : ''} ${pending ? styles.pending : ''}`}
      label={`${action} ${productName} ${favorite ? 'des' : 'aux'} favoris`}
      aria-pressed={favorite}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={() => toggle(productId)}
    >
      <Heart aria-hidden="true" />
    </IconButton>
  );
}
