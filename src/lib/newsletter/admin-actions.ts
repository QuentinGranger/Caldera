'use server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
import { imageStorage } from '@/lib/storage/images';
import { adminTransaction, audit } from '@/lib/admin/common';
import { AdminError } from '@/lib/admin/validation';
import {
  duplicateNewsletterCampaign,
  cancelNewsletterCampaign,
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

export async function duplicateNewsletterCampaignAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const campaign = await duplicateNewsletterCampaign(admin.id, form);
    revalidatePath('/admin/newsletter');
    return {
      success: true,
      message: 'Copie créée en brouillon.',
      redirectTo: `/admin/newsletter/campagnes/${campaign.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function cancelNewsletterCampaignAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    await cancelNewsletterCampaign(admin.id, form);
    revalidatePath('/admin/newsletter');
    revalidatePath(`/admin/newsletter/campagnes/${form.get('id')}`);
    return {
      success: true,
      message: 'Programmation annulée. Le contenu est à nouveau modifiable.',
      redirectTo: `/admin/newsletter/campagnes/${form.get('id')}`,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function uploadNewsletterImageAction(
  form: FormData,
): Promise<{ url?: string; error?: string }> {
  const admin = await requireAdmin();
  const file = form.get('file');
  if (!(file instanceof File) || file.size > 4 * 1024 * 1024)
    return {
      error: 'Sélectionnez une image JPEG, PNG ou WebP de 4 Mo maximum.',
    };
  let url: string | undefined;
  try {
    url = await imageStorage.upload(file);
    await adminTransaction(admin.id, (tx) =>
      audit(
        tx,
        admin.id,
        'NEWSLETTER_IMAGE_UPLOADED',
        'NewsletterImage',
        url!.replace('/media/', '').replace('.webp', ''),
      ),
    );
    return { url };
  } catch (error) {
    if (url) await imageStorage.delete(url);
    return { error: failure(error).message };
  }
}
