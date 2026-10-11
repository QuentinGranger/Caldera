import Link from 'next/link';
import { AccountForm } from '@/components/account/AccountForm';
import { LinkTokenInput } from '@/components/auth/LinkTokenInput';
import { Container } from '@/components/ui/Container/Container';
import { restoreSelectionAction } from '@/lib/lifecycle/actions';
export const metadata = {
  title: 'Reprendre votre sélection',
  robots: { index: false, follow: false },
};
export default function RecoverSelection() {
  return (
    <main id="contenu" style={{ padding: '5rem 0' }}>
      <Container>
        <h1>Reprendre votre sélection</h1>
        <p>
          Les prix et le stock sont vérifiés à nouveau. Aucun paiement ni
          information de compte n’est repris par ce lien. Votre panier actuel ne
          sera pas remplacé.
        </p>
        <AccountForm
          action={restoreSelectionAction}
          submit="Reprendre ma sélection"
          id="reprise"
        >
          <LinkTokenInput missing="Ouvrez le lien reçu dans votre e-mail pour reprendre votre sélection." />
        </AccountForm>
        <Link href="/catalogue">Retour au catalogue</Link>
      </Container>
    </main>
  );
}
