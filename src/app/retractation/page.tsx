import type { Metadata } from 'next';
import Link from 'next/link';
import { Undo2 } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { WithdrawalForm } from '@/components/returns/WithdrawalForm';
import page from '@/components/newsletter/NewsletterPage.module.scss';

export const metadata: Metadata = {
  title: 'Se rétracter d’une commande',
  description:
    'Exercez votre droit de rétractation en ligne : numéro de commande et adresse e-mail suffisent, l’accusé de réception vous est envoyé par e-mail.',
  alternates: { canonical: '/retractation' },
  robots: { index: false, follow: true },
};

/** The online withdrawal function announced by the CGV (art. 12.2). */
export default function WithdrawalPage() {
  return (
    <main id="contenu" tabIndex={-1} className={page.main}>
      <Container>
        <section className={page.card} aria-labelledby="retractation-titre">
          <Undo2 size={38} strokeWidth={1.5} aria-hidden="true" />
          <p className={page.eyebrow}>Droit de rétractation</p>
          <h1 id="retractation-titre">Se rétracter du contrat</h1>
          <p className={page.lead}>
            Vous disposez de 14 jours après la réception de votre commande pour
            vous rétracter, sans avoir à vous justifier. Ce formulaire concerne
            toute la commande ; pour ne retourner que certains articles, ouvrez
            votre commande depuis l’e-mail de confirmation ou{' '}
            <Link href="/compte/commandes">votre compte</Link>.
          </p>
          <WithdrawalForm />
          <p className={page.lead}>
            Un accusé de réception est envoyé à l’adresse de la commande, avec
            l’adresse de retour. Vous pouvez aussi vous rétracter par e-mail à
            contact@lesterresdecaldera.fr. Conditions :{' '}
            <Link href="/cgv#article-12">CGV, articles 12 à 14</Link>.
          </p>
        </section>
      </Container>
    </main>
  );
}
