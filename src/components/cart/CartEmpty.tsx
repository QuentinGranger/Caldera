import { Compass } from 'lucide-react';
import Link from 'next/link';
import styles from './CartEmpty.module.scss';
export function CartEmpty({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className={styles.empty}>
      <Compass size={40} strokeWidth={1} aria-hidden="true" />
      <h2>Votre panier est vide</h2>
      <p>
        Partez à la découverte des terres et composez votre prochaine
        collection.
      </p>
      <Link href="/catalogue" onClick={onNavigate}>
        Découvrir le catalogue
      </Link>
    </div>
  );
}
