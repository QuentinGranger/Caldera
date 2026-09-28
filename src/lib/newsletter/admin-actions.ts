'use server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminError } from '@/lib/admin/validation';
import {
  queueNewsletterCampaign,
  saveNewsletterCampaign,
  sendNewsletterCampaignTest,
} from './campaigns';

function failure(error: unknown): AdminActionState {
  if (error instanceof AdminError)
    return { success: false, message: error.message };
  console.error(
    JSON.stringify({
      scope: 'newsletter_campaign',
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

export async function saveNewsletterCampaignAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const campaign = await saveNewsletterCampaign(admin.id, form);
    revalidatePath('/admin/newsletter');
    revalidatePath(`/admin/newsletter/campagnes/${campaign.id}`);
    return {
      success: true,
      message: 'Brouillon enregistré.',
      redirectTo: `/admin/newsletter/campagnes/${campaign.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function sendNewsletterCampaignTestAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    await sendNewsletterCampaignTest(admin, form);
    return {
      success: true,
      message: `E-mail de test envoyé à ${admin.email}.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function queueNewsletterCampaignAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const campaign = await queueNewsletterCampaign(admin.id, form);
    revalidatePath('/admin/newsletter');
    revalidatePath(`/admin/newsletter/campagnes/${campaign.id}`);
    return {
      success: true,
      message: `Campagne mise en file pour ${campaign.recipientCount} abonné${campaign.recipientCount > 1 ? 's' : ''}.`,
      redirectTo: `/admin/newsletter/campagnes/${campaign.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}
