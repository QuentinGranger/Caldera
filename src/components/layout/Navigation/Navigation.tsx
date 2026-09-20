import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { navigation } from '@/data/navigation';
import styles from './Navigation.module.scss';
export function Navigation() {
  return (
    <nav className={styles.navigation} aria-label="Navigation principale">
      <ul>
        {navigation.map(({ label, href }, index) => (
          <li key={label}>
            <Link href={href}>
              {label}
              {index === 0 && <ChevronDown size={12} aria-hidden="true" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
