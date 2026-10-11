'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronDown, ExternalLink, ShieldCheck } from 'lucide-react';
import styles from './Admin.module.scss';

export function AdminAccountMenu({
  name,
  email,
  children,
}: {
  name: string;
  email: string;
  children: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return (
    <details
      ref={menu}
      className={styles.accountMenu}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && menu.current?.open) {
          menu.current.open = false;
          menu.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary aria-label="Compte administrateur">
        <span className={styles.avatar} aria-hidden="true">
          {initials}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className={styles.accountPopover}>
        <div>
          <strong>{name}</strong>
          <small>{email}</small>
        </div>
        <Link href="/admin/securite">
          <ShieldCheck size={16} aria-hidden="true" />
          Sécurité du compte
        </Link>
        <Link href="/">
          <ExternalLink size={16} aria-hidden="true" />
          Voir la boutique
        </Link>
        {children}
      </div>
    </details>
  );
}
