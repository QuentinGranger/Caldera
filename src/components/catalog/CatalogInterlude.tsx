import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './Catalog.module.scss';

export interface InterludeContent {
  image: string;
  eyebrow: string;
  title: string;
  text: string;
  link: { href: string; label: string };
}

/** The whole catalogue's window: the world that gave the shop its name. */
const UNIVERSE: InterludeContent = {
  image: '/assets/images/PremiersExplorateurs.png',
  eyebrow: 'Explorer Caldera',
  title: 'Au-delà des collections',
  text: 'Le monde qui a donné son nom à la boutique : cinq territoires, des archives et une route à suivre.',
  link: { href: '/univers', label: 'Découvrir l’univers' },
};

/**
 * A window between two rows of products: mostly image, one line, one way
 * in. It never speaks of the products themselves, and whoever is shopping
 * just scrolls past it.
 */
export function CatalogInterlude({
  content = UNIVERSE,
}: {
  content?: InterludeContent;
}) {
  return (
    <aside className={styles.interlude} aria-labelledby="interlude-title">
      <Image
        src={content.image}
        alt=""
        fill
        sizes="(min-width: 1312px) 1312px, 100vw"
      />
      <div className={styles.interludeText}>
        <p className={styles.interludeEyebrow}>{content.eyebrow}</p>
        <h3 id="interlude-title">{content.title}</h3>
        <p>{content.text}</p>
        <Link href={content.link.href} className={styles.interludeLink}>
          {content.link.label} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
