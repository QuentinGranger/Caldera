import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container/Container';
import { unsubscribeFromNewsletter } from '@/lib/newsletter/service';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = {
  title: 'Désinscription newsletter | Les Terres de Caldera',
  robots: { index: false, follow: false },
};

export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? '';
  const unsubscribed = await unsubscribeFromNewsletter(token);

  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <div className={styles.auth}>
          <section className={styles.card}>
            <p className={styles.eyebrow}>LES NOUVELLES DE CALDERA</p>
            <h1>
              {unsubscribed ? 'Désinscription confirmée' : 'Lien invalide'}
            </h1>
            <p>
              {unsubscribed
                ? 'Vous ne recevrez plus les nouvelles de Caldera. Vous pourrez vous réinscrire à tout moment depuis la boutique.'
                : 'Ce lien de désinscription est invalide.'}
            </p>
            <Link className={styles.button} href="/">
              Retour à l’accueil
            </Link>
          </section>
        </div>
      </Container>
    </main>
  );
}
