import Image from 'next/image';
import { CartButton } from '@/components/cart/CartButton';
import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { IconLink } from '@/components/ui/IconButton/IconButton';
import { Navigation } from '@/components/layout/Navigation/Navigation';
import { MobileNavigation } from '@/components/layout/MobileNavigation/MobileNavigation';
import { getSiteNavigation, headerItems } from '@/data/navigation';
import { currentCustomer } from '@/lib/account/auth';
import styles from './Header.module.scss';
import { HeaderSearch } from '@/components/layout/HeaderSearch/HeaderSearch';
import { HeaderWishlistLink } from '@/components/wishlist/HeaderWishlistLink';
export async function Header() {
  const [navigation, customer] = await Promise.all([
    getSiteNavigation(),
    currentCustomer(),
  ]);
  return (
    <header className={styles.header}>
      <Container className={styles.inner}>
        <MobileNavigation
          navigation={navigation}
          signedIn={Boolean(customer)}
        />
        <Link
          href="/"
          className={styles.brand}
          aria-label="Les Terres de Caldera — Accueil"
        >
          {/* Not the LCP element: eager, without a preload hint. */}
          <Image
            src="/assets/brand/logo-header-no-bg.png"
            alt="Les Terres de Caldera"
            width={1774}
            height={887}
            sizes="(min-width: 1200px) 152px, 108px"
            loading="eager"
          />
        </Link>
        <Navigation items={headerItems(navigation)} />
        <div
          className={styles.actions}
          role="group"
          aria-label="Services de la boutique"
        >
          <HeaderSearch />
          <IconLink
            href={navigation.account.href}
            className={styles.desktop}
            label={navigation.account.label}
          >
            <UserRound aria-hidden="true" />
          </IconLink>
          <HeaderWishlistLink className={styles.desktop} />
          <CartButton />
        </div>
      </Container>
    </header>
  );
}
