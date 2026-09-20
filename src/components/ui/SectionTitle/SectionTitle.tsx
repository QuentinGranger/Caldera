import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import styles from './SectionTitle.module.scss';
type Props = {
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
  link?: { href: string; label: string };
};
export function SectionTitle({ id, title, eyebrow, description, link }: Props) {
  return (
    <div className={styles.heading}>
      <div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h2 id={id}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {link && (
        <Link href={link.href} className={styles.link}>
          {link.label}
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
