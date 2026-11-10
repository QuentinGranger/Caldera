import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import styles from './NewsletterCta.module.scss';
import { newsletterCopy } from '@/lib/newsletter/copy';

export function NewsletterCta({
  eyebrow = 'Les nouvelles de Caldera',
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: string;
}) {
  const preparing =
    process.env.CATALOG_DEMO_MODE === '1' || process.env.STORE_OPEN !== '1';
  const copy = newsletterCopy(preparing);
  const label = preparing ? 'La lettre de Caldera' : eyebrow;
  return (
    <aside className={styles.cta} aria-label={label}>
      <Mail size={28} strokeWidth={1.4} aria-hidden="true" />
      <div>
        <p className={styles.eyebrow}>{label}</p>
        <h2>{preparing ? copy.title : title}</h2>
        <p>{preparing ? copy.shortLead : children}</p>
      </div>
      <Link href="/newsletter">
        {preparing ? 'Être prévenu' : 'S’inscrire'}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </aside>
  );
}
