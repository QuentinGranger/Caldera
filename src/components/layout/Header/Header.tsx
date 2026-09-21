import Image from 'next/image';
import { CartButton } from '@/components/cart/CartButton';
import Link from 'next/link';
import { Heart, UserRound } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { Navigation } from '@/components/layout/Navigation/Navigation';
import { MobileNavigation } from '@/components/layout/MobileNavigation/MobileNavigation';
import styles from './Header.module.scss';
import { HeaderSearch } from '@/components/layout/HeaderSearch/HeaderSearch';
import type { CustomerView } from '@/lib/auth/customer/session';
import { HeaderChrome } from './HeaderChrome';
export function Header({ customer }: { customer: CustomerView | null }) {
  return (
    <HeaderChrome>
      <Container className={styles.inner}>
        <MobileNavigation isAuthenticated={Boolean(customer)} />
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
            sizes="(min-width: 1200px) 340px, (min-width: 480px) 320px, 168px"
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
          <Link
            className={`${styles.actionItem} ${styles.accountLink} ${styles.desktop}`}
            href={customer ? '/compte' : '/connexion'}
            aria-label={customer ? 'Mon compte' : 'Se connecter'}
          >
            <UserRound aria-hidden="true" />
          </Link>
          {customer && (
            <Link
              className={`${styles.actionItem} ${styles.desktop}`}
              href="/compte/favoris"
              aria-label="Mes favoris"
            >
              <Heart aria-hidden="true" />
            </Link>
          )}
          <CartButton />
        </div>
      </Container>
    </HeaderChrome>
  );
}
