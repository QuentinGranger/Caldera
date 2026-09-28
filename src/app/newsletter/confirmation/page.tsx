import type { Metadata } from 'next';
import { NewsletterActionForm } from '@/components/newsletter/NewsletterActionForm';
import { NewsletterPage } from '@/components/newsletter/NewsletterPage';
import { confirmNewsletterAction } from '@/lib/newsletter/actions';

export const metadata: Metadata = { title: 'Confirmer la newsletter' };

export default async function NewsletterConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const value = typeof token === 'string' ? token : '';
  return (
    <NewsletterPage
      title="Confirmez votre inscription"
      lead="Cette confirmation nous assure que l’adresse vous appartient. Le lien est valable 24 heures et ne sert qu’une fois."
    >
      {value ? (
        <NewsletterActionForm
          action={confirmNewsletterAction}
          token={value}
          submit="Confirmer mon inscription"
        />
      ) : (
        <p>Ce lien est incomplet. Réinscrivez-vous depuis la page d’accueil.</p>
      )}
    </NewsletterPage>
  );
}
