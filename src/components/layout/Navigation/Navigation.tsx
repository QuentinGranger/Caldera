'use client';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { navigation } from '@/data/navigation';
import styles from './Navigation.module.scss';
export function Navigation() {
  const pathname = usePathname();
  return (
    <nav className={styles.navigation} aria-label="Navigation principale">
      <ul>
        {navigation.map(({ label, href }, index) => (
          <li key={label}>
            <Link
              href={href}
              aria-current={
                pathname === href || pathname.startsWith(`${href}/`)
                  ? 'page'
                  : undefined
              }
            >
              {label}
              {index === 0 && <ChevronDown size={12} aria-hidden="true" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
