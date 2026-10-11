'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/components/wishlist/WishlistProvider';
import styles from './Account.module.scss';

export function AccountWishlistTile() {
  const { count } = useWishlist();
  return (
    <Link href="/favoris" className={styles.tile}>
      <Heart size={20} aria-hidden="true" />
      <span className={styles.tileLabel}>Mes favoris</span>
      <strong className={styles.tileValue}>{count}</strong>
      <span className={styles.tileHint}>Votre sélection enregistrée</span>
    </Link>
  );
}
