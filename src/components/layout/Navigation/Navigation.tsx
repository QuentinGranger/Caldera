'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { NavItem, NavLink } from '@/data/navigation';
import styles from './Navigation.module.scss';

const within = (pathname: string, href: string) =>
  href === '/'
    ? pathname === '/'
    : pathname === href || pathname.startsWith(`${href}/`);

/** The entry of the current section: its own page or one of its links. */
function isCurrent(pathname: string, item: NavItem) {
  const links: NavLink[] = [
    item,
    ...item.children,
    ...(item.groups ?? []).flatMap((group) => group.links),
  ];
  return links.some((link) => within(pathname, link.href));
}

// Sub-links are real links in the HTML, revealed on hover and keyboard focus.
export function Navigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // One highlighted entry: the most specific match wins (a game over the shop).
  const current = [...items]
    .reverse()
    .find((item) => isCurrent(pathname, item))?.href;
  return (
    <nav className={styles.navigation} aria-label="Navigation principale">
      <ul className={styles.menu}>
        {items.map((item) => {
          const hasPanel = Boolean(item.groups?.length);
          const hasMenu = hasPanel || item.children.length > 0;
          return (
            <li
              key={item.href}
              className={
                hasPanel
                  ? styles.hasPanel
                  : hasMenu
                    ? styles.hasMenu
                    : undefined
              }
            >
              <Link
                href={item.href}
                className={item.href === current ? styles.current : undefined}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {item.label}
                {hasMenu && <ChevronDown size={12} aria-hidden="true" />}
              </Link>
              {hasPanel ? (
                <div className={styles.panel}>
                  {item.groups!.map((group) => (
                    <div key={group.title} className={styles.column}>
                      <p className={styles.columnTitle}>{group.title}</p>
                      <ul>
                        {group.links.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              aria-current={
                                pathname === link.href ? 'page' : undefined
                              }
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                item.children.length > 0 && (
                  <ul className={styles.submenu}>
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={
                            pathname === child.href ? 'page' : undefined
                          }
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
