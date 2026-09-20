'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
// Keep server-rendered navigation intact, but use the dedicated checkout shell.
export function StorefrontOnly({ children }: { children: ReactNode }) {
  const path = usePathname();
  return path === '/checkout' ||
    path.startsWith('/checkout/') ||
    path === '/admin' ||
    path.startsWith('/admin/') ? null : (
    <div className="storefront-chrome">{children}</div>
  );
}
