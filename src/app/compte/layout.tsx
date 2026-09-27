import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Private area: never indexed (robots.txt and src/proxy.ts add the same rule).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}
