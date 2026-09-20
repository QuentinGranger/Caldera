import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import styles from '@/components/admin/Admin.module.scss';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Administration — Caldera',
  robots: { index: false, follow: false },
};
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={styles.admin}>{children}</div>;
}
