'use client';

import { Heart } from 'lucide-react';
import { IconLink } from '@/components/ui/IconButton/IconButton';
import { useWishlist } from './WishlistProvider';
import styles from './HeaderWishlistLink.module.scss';

export function HeaderWishlistLink({ className = '' }: { className?: string }) {
  const { count } = useWishlist();
  const label = count
    ? `Favoris — ${count} ${count > 1 ? 'produits' : 'produit'}`
    : 'Favoris';
  return (
    <IconLink
      href="/favoris"
      className={`${className} ${count ? styles.active : ''}`}
      label={label}
    >
      <Heart aria-hidden="true" />
    </IconLink>
  );
}
