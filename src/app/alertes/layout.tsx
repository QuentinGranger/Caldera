import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Opened from e-mails only: never indexed (robots.txt and src/proxy.ts too).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function StockAlertLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
