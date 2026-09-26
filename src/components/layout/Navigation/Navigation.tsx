import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { NavItem } from '@/data/navigation';
import styles from './Navigation.module.scss';
// Sub-links are real links in the HTML, revealed on hover and keyboard focus.
export function Navigation({ items }: { items: NavItem[] }) {
  return (
    <nav className={styles.navigation} aria-label="Navigation principale">
      <ul className={styles.menu}>
        {items.map((item) => (
          <li
            key={item.href}
            className={item.children.length ? styles.hasMenu : undefined}
          >
            <Link href={item.href}>
              {item.label}
              {item.children.length > 0 && (
                <ChevronDown size={12} aria-hidden="true" />
              )}
            </Link>
            {item.children.length > 0 && (
              <ul className={styles.submenu}>
                {item.children.map((child) => (
                  <li key={child.href}>
                    <Link href={child.href}>{child.label}</Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
