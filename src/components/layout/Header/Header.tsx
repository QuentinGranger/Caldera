import Image from 'next/image';
import { CartButton } from '@/components/cart/CartButton';
import Link from 'next/link';
import { Heart, UserRound } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Navigation } from '@/components/layout/Navigation/Navigation';
import { MobileNavigation } from '@/components/layout/MobileNavigation/MobileNavigation';
import styles from './Header.module.scss';
import { HeaderSearch } from '@/components/layout/HeaderSearch/HeaderSearch';
export function Header() {
  return (
    <header className={styles.header}>
      <Container className={styles.inner}>
        <MobileNavigation />
        <Link
          href="/"
          className={styles.brand}
          aria-label="Les Terres de Caldera — Accueil"
        >
          <Image
            src="/assets/brand/logo-header-no-bg.png"
            alt="Les Terres de Caldera"
            width={1774}
            height={887}
            sizes="(min-width: 1200px) 240px, (min-width: 480px) 210px, 160px"
            preload
          />
        </Link>
        <Navigation />
        <div
          className={styles.actions}
          role="group"
          aria-label="Services de la boutique"
        >
          <HeaderSearch />
          <IconButton
            className={styles.desktop}
            label="Compte — bientôt disponible"
            disabled
          >
            <UserRound aria-hidden="true" />
          </IconButton>
          <IconButton
            className={styles.desktop}
            label="Favoris — bientôt disponibles"
            disabled
          >
            <Heart aria-hidden="true" />
          </IconButton>
          <CartButton />
        </div>
      </Container>
    </header>
  );
}
