import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { HomeFamily } from '@/components/home/homeData';
import { listFr } from '@/lib/seo/metadata';
import styles from './Families.module.scss';

/** « Produits scellés » → « produits scellés »; keeps « ETB ». */
function inSentence(name: string) {
  return /\p{Lu}/u.test(name.slice(1))
    ? name
    : name.charAt(0).toLocaleLowerCase('fr-FR') + name.slice(1);
}

const products = (count: number) => `${count} produit${count > 1 ? 's' : ''}`;

/**
 * What Caldera sells, right after the hero and in its night: the families
 * that have products, the first one given the most room.
 */
export function Families({ families }: { families: HomeFamily[] }) {
  if (!families.length) return null;
  // Root families never overlap: their counts add up.
  const total = families.reduce((sum, family) => sum + family.count, 0);
  const names = families.map((family, index) =>
    index ? inSentence(family.name) : family.name,
  );
  return (
    <section
      id="familles"
      className={styles.section}
      aria-labelledby="families-title"
    >
      <div className={styles.inner}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>Le Pokémon TCG à Caldera</p>
          <h2 id="families-title">
            Des pièces à ouvrir, <em>d’autres à garder.</em>
          </h2>
          <p>
            {listFr(names)}&nbsp;: {products(total)} en ligne.
          </p>
        </header>
        <ul className={styles.grid} data-count={Math.min(families.length, 4)}>
          {families.map((family, index) => (
            <li key={family.id}>
              <Link href={family.href} className={styles.card}>
                <span className={styles.stage}>
                  <Image
                    src={family.imageUrl}
                    alt=""
                    fill
                    sizes={
                      index === 0
                        ? '(min-width: 1200px) 420px, (min-width: 768px) 38vw, 62vw'
                        : '(min-width: 1200px) 320px, (min-width: 768px) 32vw, 62vw'
                    }
                  />
                </span>
                <span className={styles.caption}>
                  <span className={styles.count}>{products(family.count)}</span>
                  <span className={styles.name}>{family.name}</span>
                  {family.description && (
                    <span className={styles.description}>
                      {family.description}
                    </span>
                  )}
                </span>
                <span className={styles.arrow} aria-hidden="true">
                  <ArrowUpRight size={18} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
