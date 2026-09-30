'use server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminError } from '@/lib/admin/validation';
import { issueMissingInvoice, saveInvoiceSettings } from './admin';

function failure(error: unknown): AdminActionState {
  if (error instanceof AdminError)
    return { success: false, message: error.message };
  console.error(
    JSON.stringify({
      scope: 'invoices',
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

export async function saveInvoiceSettingsAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    await saveInvoiceSettings(admin.id, form);
    revalidatePath('/admin/factures', 'layout');
    return {
      success: true,
      message:
        'Réglages enregistrés : ils s’appliquent aux prochaines factures, jamais à celles déjà émises.',
    };
  } catch (error) {
    return failure(error);
  }
}

export async function issueInvoiceAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const invoice = await issueMissingInvoice(admin.id, form);
    revalidatePath(`/admin/commandes/${invoice.orderId}`);
    revalidatePath('/admin/factures');
    return { success: true, message: `Facture ${invoice.number} émise.` };
  } catch (error) {
    return failure(error);
  }
}
