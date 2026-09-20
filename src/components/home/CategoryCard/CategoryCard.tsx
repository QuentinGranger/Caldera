import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { getHomeCategories } from '@/lib/catalog/queries';
import styles from './CategoryCard.module.scss';
export function CategoryCard({
  category,
  index,
}: {
  category: Awaited<ReturnType<typeof getHomeCategories>>[number];
  index: number;
}) {
  return (
    <Link
      href={`/categorie/${category.slug}`}
      className={`${styles.card} ${styles[['forest', 'sand', 'clay', 'sage'][index % 4]!]}`}
    >
      <span className={styles.number}>TERRITOIRE 0{index + 1}</span>
      <div className={styles.visual}>
        <Image
          src={category.imageUrl}
          alt=""
          fill
          sizes="(min-width: 1200px) 280px, (min-width: 768px) 40vw, 45vw"
        />
      </div>
      <div className={styles.bottom}>
        <div>
          <h3>{category.name}</h3>
          <p>{category.description}</p>
        </div>
        <span className={styles.arrow}>
          <ArrowUpRight size={18} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
