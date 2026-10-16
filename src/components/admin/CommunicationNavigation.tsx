'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Mail,
  BookOpen,
  CalendarDays,
  MessageSquare,
  ArrowUpRight,
} from 'lucide-react';
import styles from './Communication.module.scss';
const links = [
  { href: '/admin/newsletter', label: 'Newsletter', icon: Mail },
  { href: '/admin/carnets', label: 'Carnets', icon: BookOpen },
  {
    href: '/admin/carnets/calendrier',
    label: 'Calendrier',
    icon: CalendarDays,
  },
  { href: '/admin/discord', label: 'Discord', icon: MessageSquare },
];
export function CommunicationNavigation() {
  const path = usePathname();
  const active = links
    .filter((link) => path === link.href || path.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!active) return null;
  return (
    <div className={styles.workspaceNav}>
      <span className={styles.workspaceLabel}>Communication</span>
      <nav aria-label="Espace communication">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active.href === href ? 'page' : undefined}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <Link href="/admin/mesures" className={styles.measureLink}>
        Résultats <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}
