import type { Metadata } from 'next';
import { AccountForm } from '@/components/account/AccountForm';
import { LinkTokenInput } from '@/components/auth/LinkTokenInput';
import { StockAlertPage } from '@/components/stock-alerts/StockAlertPage';
import { removeStockAlertAction } from '@/lib/stock-alerts/actions';
import accountStyles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Supprimer une alerte' };

export default function StockAlertRemovalPage() {
  return (
    <StockAlertPage
      title="Supprimer cette alerte"
      lead="Aucun e-mail ne vous sera envoyé pour ce produit et votre adresse sera effacée de cette alerte."
    >
      <AccountForm
        action={removeStockAlertAction}
        submit="Supprimer l’alerte"
        done
        wide
      >
        <LinkTokenInput
          className={accountStyles.error}
          missing="Ce lien est incomplet : ouvrez le lien complet reçu par e-mail."
        />
      </AccountForm>
    </StockAlertPage>
  );
}
