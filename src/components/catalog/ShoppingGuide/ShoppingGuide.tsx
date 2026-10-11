import Link from 'next/link';
import { ArrowRight, ChevronDown, Compass, Gem, Package } from 'lucide-react';
import type { getShoppingIntentLinks } from '@/lib/catalog/queries';
import styles from './ShoppingGuide.module.scss';

const icons = [Compass, Gem, Package];
export function ShoppingGuide({
  intents,
  compact = false,
}: {
  intents: Awaited<ReturnType<typeof getShoppingIntentLinks>>;
  compact?: boolean;
}) {
  const content = (
    <section
      id="vos-envies"
      className={styles.guide}
      data-compact={compact || undefined}
      aria-labelledby="shopping-guide-title"
    >
      <header className={styles.head}>
        <p className={styles.eyebrow}>À chaque envie, son chemin</p>
        <h2 id="shopping-guide-title">
          Que souhaitez-vous <em>découvrir ?</em>
        </h2>
        <p>Quelques repères pour choisir un produit qui vous correspond.</p>
      </header>
      <ul className={styles.cards}>
        {intents.map((intent, index) => {
          const Icon = icons[index] ?? Compass;
          return (
            <li key={intent.slug}>
              <Icon size={27} strokeWidth={1.25} aria-hidden="true" />
              <h3>{intent.title}</h3>
              <p>{intent.description}</p>
              <p className={styles.advice}>{intent.advice}</p>
              <div className={styles.links}>
                {intent.href && (
                  <Link href={intent.href}>
                    Voir la sélection{' '}
                    <ArrowRight size={15} aria-hidden="true" />
                    <span className={styles.srOnly}> : {intent.title}</span>
                  </Link>
                )}
                <Link href={`/guides/${intent.guide}`}>
                  Lire le guide
                  <span className={styles.srOnly}> : {intent.title}</span>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
  if (!compact) return content;
  return (
    <details className={styles.disclosure}>
      <summary>
        Besoin d’aide pour choisir ?{' '}
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      {content}
    </details>
  );
}
