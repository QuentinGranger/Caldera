import type { Metadata } from 'next';
import { AccountForm } from '@/components/account/AccountForm';
import { LinkTokenInput } from '@/components/auth/LinkTokenInput';
import { StockAlertPage } from '@/components/stock-alerts/StockAlertPage';
import { confirmStockAlertAction } from '@/lib/stock-alerts/actions';
import accountStyles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Confirmer votre alerte' };

// A click confirms: mail scanners that open links never do.
export default function StockAlertConfirmationPage() {
  return (
    <StockAlertPage
      title="Confirmez votre alerte"
      lead="Cette confirmation nous assure que l’adresse vous appartient. Vous recevrez ensuite un e-mail, une seule fois, dès le retour du produit."
    >
      <AccountForm
        action={confirmStockAlertAction}
        submit="Confirmer mon alerte"
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
