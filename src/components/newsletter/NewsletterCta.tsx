import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import styles from './NewsletterCta.module.scss';

export function NewsletterCta({
  eyebrow = 'Les nouvelles de Caldera',
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: string;
}) {
  return (
    <aside className={styles.cta} aria-label={eyebrow}>
      <Mail size={28} strokeWidth={1.4} aria-hidden="true" />
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      <Link href="/#newsletter">
        S’inscrire
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </aside>
  );
}
