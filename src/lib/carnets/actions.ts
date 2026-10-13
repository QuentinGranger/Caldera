'use server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
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
      message: 'Carnet enregistré. Aucun contenu n’a été publié ou envoyé.',
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
      message: 'Carnet restauré en brouillon.',
      redirectTo: `/admin/carnets/${chapter.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}
