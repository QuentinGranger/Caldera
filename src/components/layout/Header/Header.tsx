import Image from 'next/image';
import { CartButton } from '@/components/cart/CartButton';
import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { IconLink } from '@/components/ui/IconButton/IconButton';
import { Navigation } from '@/components/layout/Navigation/Navigation';
import { MobileNavigation } from '@/components/layout/MobileNavigation/MobileNavigation';
import { getSiteNavigation, headerItems } from '@/data/navigation';
import styles from './Header.module.scss';
import { HeaderSearch } from '@/components/layout/HeaderSearch/HeaderSearch';
export async function Header() {
  const navigation = await getSiteNavigation();
  return (
    <header className={styles.header}>
      <Container className={styles.inner}>
        <MobileNavigation navigation={navigation} />
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
            sizes="(min-width: 1200px) 240px, (min-width: 480px) 210px, 160px"
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
          <CartButton />
        </div>
      </Container>
    </header>
  );
}
