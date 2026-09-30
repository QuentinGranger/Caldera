'use server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminError } from '@/lib/admin/validation';
import { saveTaxSettings } from './admin';
import { stripeTaxGateway, TaxProviderError } from './gateway';

export async function saveTaxSettingsAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const saved = await saveTaxSettings(admin.id, form);
    revalidatePath('/admin/fiscalite');
    return {
      success: true,
      message: saved.stripeTaxEnabled
        ? 'Stripe Tax activé : la TVA des prochaines commandes sera calculée et déclarée par Stripe.'
        : 'Réglages fiscaux enregistrés.',
    };
  } catch (error) {
    if (error instanceof AdminError)
      return { success: false, message: error.message };
    console.error(
      JSON.stringify({
        scope: 'tax',
        action: 'admin_mutation_failed',
        code:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code
            : 'UNEXPECTED',
      }),
    );
    return {
      success: false,
      message: 'Action impossible. Rechargez la page puis réessayez.',
    };
  }
}

const statusText: Record<string, string> = {
  STRIPE_NON_CONFIGURE: 'aucune clé Stripe n’est configurée sur ce serveur.',
  PERMISSION_STRIPE_TAX_MANQUANTE:
    'la clé restreinte n’a pas la permission « Tax » (calculs, transactions et réglages).',
  STRIPE_INJOIGNABLE: 'Stripe ne répond pas, réessayez plus tard.',
};

/** Read-only: asks Stripe whether Stripe Tax is set up on the account. */
export async function checkStripeTaxAction(): Promise<AdminActionState> {
  await requireAdmin();
  try {
    const result = await stripeTaxGateway.status();
    return result.status === 'active'
      ? {
          success: true,
          message: 'Stripe Tax est prêt sur le compte Stripe (statut actif).',
        }
      : {
          success: false,
          message: `Stripe Tax n’est pas encore prêt : complétez ${
            result.missing.length
              ? result.missing.join(', ')
              : 'la configuration'
          } dans le Dashboard Stripe (Taxes → Paramètres), puis ajoutez votre immatriculation TVA française.`,
        };
  } catch (error) {
    return {
      success: false,
      message: `Vérification impossible : ${
        error instanceof TaxProviderError
          ? (statusText[error.code] ?? `code ${error.code}.`)
          : 'erreur inattendue.'
      }`,
    };
  }
}
