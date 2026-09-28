import type { Metadata } from 'next';
import { NewsletterActionForm } from '@/components/newsletter/NewsletterActionForm';
import { NewsletterPage } from '@/components/newsletter/NewsletterPage';
import { unsubscribeNewsletterAction } from '@/lib/newsletter/actions';

export const metadata: Metadata = { title: 'Se désinscrire de la newsletter' };

export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const value = typeof token === 'string' ? token : '';
  return (
    <NewsletterPage
      title="Se désinscrire"
      lead="Confirmez votre choix. L’adresse ne recevra plus les nouvelles et offres des Terres de Caldera."
    >
      {value ? (
        <NewsletterActionForm
          action={unsubscribeNewsletterAction}
          token={value}
          submit="Me désinscrire"
        />
      ) : (
        <p>Ce lien est incomplet.</p>
      )}
    </NewsletterPage>
  );
}
