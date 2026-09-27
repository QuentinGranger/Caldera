import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { History, MapPin, Package, ShieldCheck } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import styles from './Account.module.scss';

const BENEFITS = [
  {
    icon: Package,
    text: 'Suivez vos commandes, de la préparation à la livraison.',
  },
  {
    icon: History,
    text: 'Retrouvez aussi celles passées sans compte avec la même adresse e-mail.',
  },
  {
    icon: MapPin,
    text: 'Votre adresse de livraison est proposée à chaque commande.',
  },
  {
    icon: ShieldCheck,
    text: 'Commander sans compte reste toujours possible.',
  },
];

/**
 * Sign-in, sign-up and e-mail link pages: the form card, and beside it on
 * large screens (below it on phones) what an account brings.
 */
export function AccountShell({
  title,
  lead,
  notice,
  tabs,
  children,
}: {
  title: string;
  lead: string;
  notice?: ReactNode;
  /** Shows the « Connexion / Créer un compte » switch. */
  tabs?: 'connexion' | 'inscription';
  children: ReactNode;
}) {
  return (
    <main id="contenu" tabIndex={-1} className={styles.authMain}>
      <Container>
        <div className={styles.authGrid}>
          <section className={styles.authCard} aria-labelledby="compte-titre">
            {tabs && (
              <nav className={styles.tabs} aria-label="Accès au compte">
                <Link
                  href="/compte/connexion"
                  aria-current={tabs === 'connexion' ? 'page' : undefined}
                >
                  Connexion
                </Link>
                <Link
                  href="/compte/inscription"
                  aria-current={tabs === 'inscription' ? 'page' : undefined}
                >
                  Créer un compte
                </Link>
              </nav>
            )}
            <p className={styles.eyebrow}>Espace client</p>
            <h1 id="compte-titre" className={styles.authTitle}>
              {title}
            </h1>
            <p className={styles.lead}>{lead}</p>
            {notice && (
              <div className={styles.notice} role="status">
                {notice}
              </div>
            )}
            {children}
          </section>

          <aside className={styles.brandPanel} aria-label="Pourquoi un compte">
            <Image
              src="/assets/images/ArchiveExplorateurs.png"
              alt=""
              fill
              sizes="(min-width: 75rem) 40vw, 1px"
              className={styles.brandImage}
            />
            <div className={styles.brandContent}>
              <p className={styles.brandEyebrow}>Les Terres de Caldera</p>
              <p className={styles.brandTitle}>Votre carnet d’explorateur</p>
              <ul className={styles.benefits}>
                {BENEFITS.map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </Container>
    </main>
  );
}
