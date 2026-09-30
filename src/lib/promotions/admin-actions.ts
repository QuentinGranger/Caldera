'use server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminError } from '@/lib/admin/validation';
import { deletePromotion, savePromotion } from './admin';

function failure(error: unknown): AdminActionState {
  if (error instanceof AdminError)
    return { success: false, message: error.message };
  console.error(
    JSON.stringify({
      scope: 'promotions',
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

export async function savePromotionAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const creating = !form.get('id');
    const promotion = await savePromotion(admin.id, form);
    revalidatePath('/admin/promotions');
    revalidatePath(`/admin/promotions/${promotion.id}`);
    return {
      success: true,
      message: `Code ${promotion.code} enregistré.`,
      ...(creating ? { redirectTo: `/admin/promotions/${promotion.id}` } : {}),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePromotionAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    await deletePromotion(admin.id, form);
    revalidatePath('/admin/promotions');
    return {
      success: true,
      message: 'Code supprimé.',
      redirectTo: '/admin/promotions',
    };
  } catch (error) {
    return failure(error);
  }
}
