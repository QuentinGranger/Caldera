import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/ui/Container/Container';
import styles from '@/components/checkout/Checkout.module.scss';
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className={styles.header}>
        <Container>
          <Link href="/" aria-label="Les Terres de Caldera — Accueil">
            <Image
              src="/assets/brand/logo-header-no-bg.png"
              alt="Les Terres de Caldera"
              width={1774}
              height={887}
              sizes="180px"
            />
          </Link>
          <Link href="/panier">Retour au panier</Link>
        </Container>
      </header>
      {children}
      <footer className={styles.footer}>
        Les Terres de Caldera · Votre commande en préparation
      </footer>
    </>
  );
}
