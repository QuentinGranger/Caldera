'use server';
import { revalidatePath } from 'next/cache';
import { currentCustomer } from '@/lib/account/auth';
import { allowAccountAttempt } from '@/lib/account/limits';
import {
  accountEmail,
  type AccountActionState,
} from '@/lib/account/validation';
import {
  confirmStockAlert,
  removeCustomerStockAlert,
  removeStockAlertWithToken,
  subscribeToStockAlert,
} from './service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECK_INBOX =
  'Vérifiez votre boîte mail : confirmez l’alerte avec le lien reçu, valable 24 heures. Sans confirmation, rien n’est conservé.';
const UNAVAILABLE =
  'Les alertes sont momentanément indisponibles. Réessayez dans quelques minutes.';

const failure = (message: string, errors?: Record<string, string>) => ({
  success: false,
  message,
  ...(errors ? { errors } : {}),
});

function logUnexpected(action: string) {
  // A code only: never the address.
  console.error(
    JSON.stringify({ scope: 'stock-alert', action, code: 'UNEXPECTED' }),
  );
}

export async function subscribeStockAlertAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  // A hidden field catches simple bots without storing or contacting them.
  if (form.get('website')) return { success: true, message: CHECK_INBOX };
  const variantId = form.get('variantId');
  if (typeof variantId !== 'string' || !UUID.test(variantId))
    return failure('Choisissez une version du produit.');
  const customer = await currentCustomer();
  // A signed-in customer is alerted at the account's (verified) address.
  const email = customer ? customer.email : accountEmail(form.get('email'));
  if (!email)
    return failure('Vérifiez le champ indiqué.', {
      email: 'Indiquez une adresse e-mail valide.',
    });
  try {
    if (!(await allowAccountAttempt('stock-alert', email)))
      return { success: true, message: CHECK_INBOX };
    const outcome = await subscribeToStockAlert({
      email,
      variantId,
      customer,
    });
    if (outcome === 'available')
      return failure(
        'Bonne nouvelle : cette version est de nouveau disponible. Actualisez la page pour l’ajouter au panier.',
      );
    if (outcome === 'not-found')
      return failure('Cette version n’est plus proposée.');
    if (outcome === 'active') {
      revalidatePath('/compte/alertes');
      return {
        success: true,
        message: `C’est noté : un e-mail vous sera envoyé à ${email} dès son retour. Vos alertes sont dans votre compte.`,
      };
    }
    return { success: true, message: CHECK_INBOX };
  } catch {
    logUnexpected('subscribe_failed');
    return failure(UNAVAILABLE);
  }
}

export async function confirmStockAlertAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const token = form.get('token');
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,100}$/.test(token))
    return failure(
      'Ce lien est incomplet : ouvrez le lien complet reçu par e-mail.',
    );
  try {
    if (!(await confirmStockAlert(token)))
      return failure(
        'Ce lien a expiré ou a déjà servi. Demandez une nouvelle alerte depuis la page du produit.',
      );
    return {
      success: true,
      message:
        'Alerte confirmée : vous recevrez un e-mail, une seule fois, dès que ce produit sera de nouveau disponible.',
    };
  } catch {
    logUnexpected('confirm_failed');
    return failure(UNAVAILABLE);
  }
}

export async function removeStockAlertAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  try {
    if (!(await removeStockAlertWithToken(form.get('token'))))
      return failure('Ce lien n’est pas valable.');
    return {
      success: true,
      message:
        'Alerte supprimée : aucun e-mail ne vous sera envoyé pour ce produit.',
    };
  } catch {
    logUnexpected('remove_failed');
    return failure(UNAVAILABLE);
  }
}

export async function removeMyStockAlertAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const id = form.get('alert');
  const customer = await currentCustomer();
  if (!customer) return failure('Connectez-vous pour gérer vos alertes.');
  if (typeof id !== 'string' || !UUID.test(id))
    return failure('Alerte introuvable.');
  try {
    if (!(await removeCustomerStockAlert(customer, id)))
      return failure('Alerte introuvable.');
    revalidatePath('/compte/alertes');
    return { success: true, message: 'Alerte supprimée.' };
  } catch {
    logUnexpected('remove_mine_failed');
    return failure(UNAVAILABLE);
  }
}
