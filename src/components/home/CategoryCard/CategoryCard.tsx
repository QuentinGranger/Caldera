import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { HomeFamily } from '@/components/home/homeData';
import styles from './CategoryCard.module.scss';
export function CategoryCard({
  family,
  index,
}: {
  family: HomeFamily;
  index: number;
}) {
  return (
    <Link
      href={family.href}
      className={`${styles.card} ${styles[['forest', 'sand', 'clay', 'sage'][index % 4]!]}`}
    >
      <span className={styles.number}>
        Territoire {String(index + 1).padStart(2, '0')} · {family.count} produit
        {family.count > 1 ? 's' : ''}
      </span>
      <div className={styles.visual}>
        <Image
          src={family.imageUrl}
          alt=""
          fill
          sizes="(min-width: 1200px) 280px, (min-width: 768px) 40vw, 45vw"
        />
      </div>
      <div className={styles.bottom}>
        <div>
          <h3>{family.name}</h3>
          {family.description && <p>{family.description}</p>}
        </div>
        <span className={styles.arrow}>
          <ArrowUpRight size={18} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
