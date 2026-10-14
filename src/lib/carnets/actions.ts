'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
import { parseComptoirSelection } from './comptoir-selection';
import { getCarnetProducts } from './comptoir';
import { getPrisma } from '@/lib/db/prisma';
import { id, integer, text, whitelist } from '@/lib/admin/validation';
import {
  customizeCarnetEdition,
  restoreAutomaticCarnetEdition,
} from './edition';
import {
  queueNewsletterCampaign,
  sendNewsletterCampaignTest,
  cancelNewsletterCampaign,
} from '@/lib/newsletter/campaigns';
import { formatCarnetDate } from './dates';
import { AdminError } from '@/lib/admin/validation';
import { saveCarnetChapter, archiveCarnetChapter } from './admin';
function failure(error: unknown): AdminActionState {
  if (error instanceof AdminError)
    return { success: false, message: error.message };
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
    return {
      success: false,
      message: 'Ce numéro ou ce slug de Carnet est déjà utilisé.',
    };
  console.error(
    JSON.stringify({
      scope: 'carnets',
      action: 'admin_mutation_failed',
      code:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : 'UNEXPECTED',
    }),
  );
  return {
    success: false,
    message: 'Enregistrement impossible. Conservez votre texte puis réessayez.',
  };
}
export async function saveCarnetChapterAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const chapter = await saveCarnetChapter(admin.id, form);
    revalidatePath('/admin/carnets');
    revalidatePath(`/admin/carnets/${chapter.id}`);
    return {
      success: true,
      message:
        'Édition enregistrée. Vous pouvez vérifier l’email, vous envoyer un test et programmer sa diffusion.',
      redirectTo: `/admin/carnets/${chapter.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function archiveCarnetChapterAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const chapter = await archiveCarnetChapter(admin.id, form);
    revalidatePath('/admin/carnets');
    revalidatePath(`/admin/carnets/${chapter.id}`);
    return {
      success: true,
      message: 'Carnet archivé. Vous pouvez le restaurer.',
      redirectTo: `/admin/carnets/${chapter.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function restoreCarnetChapterAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const chapter = await archiveCarnetChapter(admin.id, form, true);
    revalidatePath('/admin/carnets');
    revalidatePath(`/admin/carnets/${chapter.id}`);
    return {
      success: true,
      message: 'Carnet restauré. Son calendrier existant est conservé.',
      redirectTo: `/admin/carnets/${chapter.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}

async function savedEdition(form: FormData) {
  whitelist(form, ['id', 'revision', 'campaignUpdatedAt']);
  const chapterId = id(form)!,
    revision = integer(form, 'revision', 0, 2147483647);
  const chapter = await getPrisma().carnetChapter.findUnique({
    where: { id: chapterId },
    include: { editionCampaign: true },
  });
  if (
    !chapter?.editionCampaign ||
    chapter.editionCampaign.chapterId !== chapterId
  )
    throw new AdminError('Enregistrez d’abord l’édition complète.');
  if (
    chapter.revision !== revision ||
    chapter.editionCampaign.updatedAt.toISOString() !==
      text(form, 'campaignUpdatedAt', 30)
  )
    throw new AdminError('L’édition a changé. Rechargez la page.');
  return chapter;
}
function refreshEdition(chapterId: string, campaignId?: string) {
  revalidatePath(`/admin/carnets/${chapterId}`);
  revalidatePath('/admin/newsletter');
  if (campaignId) revalidatePath(`/admin/newsletter/campagnes/${campaignId}`);
}
export async function testCarnetEditionAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const chapter = await savedEdition(form);
    const data = new FormData();
    data.set('id', chapter.editionCampaignId!);
    data.set('chapterRevision', String(chapter.revision));
    data.set(
      'campaignUpdatedAt',
      chapter.editionCampaign!.updatedAt.toISOString(),
    );
    await sendNewsletterCampaignTest(admin, data);
    return {
      success: true,
      message:
        'Test envoyé à l’adresse de test configurée ou à votre adresse admin. Il utilise la dernière édition enregistrée.',
    };
  } catch (error) {
    return failure(error);
  }
}
export async function queueCarnetEditionAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const chapter = await savedEdition(form),
      date = chapter.editionCampaign!.scheduledAt;
    if (!date)
      throw new AdminError('Enregistrez une date d’envoi avant de programmer.');
    const data = new FormData();
    for (const [k, v] of Object.entries({
      id: chapter.editionCampaignId!,
      audience: 'all',
      sendMode: 'later',
      scheduledAt: date.toISOString(),
      scheduledLocal: formatCarnetDate(date),
      timeZone: 'Europe/Paris',
      chapterRevision: String(chapter.revision),
      campaignUpdatedAt: chapter.editionCampaign!.updatedAt.toISOString(),
    }))
      data.set(k, v);
    const campaign = await queueNewsletterCampaign(admin.id, data);
    refreshEdition(chapter.id, campaign.id);
    return {
      success: true,
      message: `Édition programmée pour ${campaign.recipientCount} abonnés confirmés.`,
      redirectTo: `/admin/carnets/${chapter.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function advancedCarnetEditionAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  let target: string;
  try {
    const campaign = await customizeCarnetEdition(admin.id, form);
    refreshEdition(String(form.get('id')), campaign.id);
    target = `/admin/newsletter/campagnes/${campaign.id}`;
  } catch (error) {
    return failure(error);
  }
  // Server navigation survives the revision-driven editor remount after revalidation.
  redirect(target);
}
export async function automaticCarnetEditionAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const chapter = await restoreAutomaticCarnetEdition(admin.id, form);
    refreshEdition(chapter.id, chapter.editionCampaignId!);
    return {
      success: true,
      message: 'Format automatique rétabli.',
      redirectTo: `/admin/carnets/${chapter.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function cancelCarnetEditionAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const chapter = await savedEdition(form),
      data = new FormData();
    data.set('id', chapter.editionCampaignId!);
    await cancelNewsletterCampaign(admin.id, data);
    refreshEdition(chapter.id, chapter.editionCampaignId!);
    return {
      success: true,
      message: 'Programmation annulée. Vous pouvez reprendre l’édition.',
      redirectTo: `/admin/carnets/${chapter.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function searchCarnetProductsAction(form: FormData) {
  await requireAdmin();
  whitelist(form, ['search', 'selectedIds']);
  const selected = form.has('selectedIds')
    ? parseComptoirSelection(text(form, 'selectedIds', 300))
    : [];
  return getCarnetProducts(selected, text(form, 'search', 120, false));
}
