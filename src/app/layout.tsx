import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { AnnouncementBar } from '@/components/layout/AnnouncementBar/AnnouncementBar';
import { Footer } from '@/components/layout/Footer/Footer';
import { Header } from '@/components/layout/Header/Header';

import { CartProvider } from '@/components/cart/CartProvider';
import { getCart } from '@/lib/cart/getCart';
import { StorefrontOnly } from '@/components/layout/StorefrontOnly/StorefrontOnly';
import { SpeedInsights } from '@/components/monitoring/SpeedInsights';
import { rootMetadata } from '@/components/layout/siteMetadata';

import './globals.scss';

const headingFont = localFont({
  src: './fonts/cormorant-garamond.woff2',
  variable: '--font-cormorant',
  weight: '300 700',
  display: 'swap',
});
const bodyFont = localFont({
  src: './fonts/manrope.woff2',
  variable: '--font-manrope',
  weight: '200 800',
  display: 'swap',
});

// Title template « %s | Caldera », Open Graph and Twitter defaults.
export const metadata: Metadata = rootMetadata();

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body>
        <a className="skip-link" href="#contenu">
          Aller au contenu
        </a>
        <CartProvider cart={await getCart()}>
          <StorefrontOnly>
            <AnnouncementBar />
            <Header />
          </StorefrontOnly>
          {children}
          <StorefrontOnly>
            <Footer />
            <SpeedInsights />
          </StorefrontOnly>
        </CartProvider>
      </body>
    </html>
  );
}
