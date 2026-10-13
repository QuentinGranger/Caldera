import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { adminTransaction, audit } from '@/lib/admin/common';
import { requireAdmin } from '@/lib/admin/auth';
import {
  AdminError,
  id,
  integer,
  whitelist,
  uuid,
} from '@/lib/admin/validation';
import { param, type SearchParams } from '@/lib/admin/queries';
import { CARNET_STATUSES, type CarnetContent } from './content';
import { carnetInput } from './input';
import { assertCarnetCalendar, carnetPublicDate } from './dates';
import { imageStorage } from '@/lib/storage/images';

export async function saveCarnetChapter(adminId: string, form: FormData) {
  const input = carnetInput(form);
  const file = form.get('illustrationFile');
  if (file !== null && !(file instanceof File))
    throw new AdminError('Fichier illustration invalide.');
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (upload && upload.size > 4 * 1024 * 1024)
    throw new AdminError('Illustration limitée à 4 Mo.');
  let uploadedUrl: string | null = null;
  if (upload) {
    if (!input.data.illustrationAlt?.trim())
      throw new AdminError('Ajoutez le texte alternatif de l’illustration.');
    await adminTransaction(adminId, async (tx) => {
      if (input.id) {
        const current = await tx.carnetChapter.findUnique({
          where: { id: input.id },
        });
        if (
          !current ||
          !['DRAFT', 'READY'].includes(current.status) ||
          current.revision !== input.revision
        )
          throw new AdminError(
            'Carnet non modifiable ou version périmée. Rechargez avant de téléverser.',
          );
      }
    });
    uploadedUrl = await imageStorage.upload(upload);
    input.data.illustrationUrl = uploadedUrl;
  }
  try {
    return await adminTransaction(adminId, async (tx) => {
      const data = {
        ...input.data,
        ...(input.data.earlyAccessAt !== undefined
          ? {
              publicAt: input.data.earlyAccessAt
                ? carnetPublicDate(input.data.earlyAccessAt)
                : null,
            }
          : {}),
        content: input.data.content as unknown as Prisma.InputJsonValue,
      };
      if (input.id) {
        await tx.$queryRaw`SELECT id FROM "CarnetChapter" WHERE id = ${input.id}::uuid FOR UPDATE`;
        const current = await tx.carnetChapter.findUnique({
          where: { id: input.id },
        });
        if (!current) throw new AdminError('Carnet introuvable.');
        if (current.status === 'ARCHIVED')
          throw new AdminError('Restaurez le Carnet avant de le modifier.');
        if (current.status === 'PUBLIC' || current.status === 'EARLY_ACCESS')
          throw new AdminError(
            'Les modifications des chapitres publiés seront disponibles avec le service de publication.',
          );
        if (current.publishedAt && data.slug !== current.slug)
          throw new AdminError(
            'L’adresse d’un Carnet déjà publié doit rester stable.',
          );
        if (current.releaseCampaignId || current.publishedAt)
          throw new AdminError(
            'Le Carnet est engagé dans une diffusion. Annulez la programmation avant le premier envoi pour le modifier ; après le début d’envoi, le calendrier et le récit sont figés.',
          );
        if (current.revision !== input.revision)
          throw new AdminError(
            'Ce Carnet a été modifié dans un autre onglet. Conservez votre texte, puis rechargez pour consulter la version enregistrée.',
          );
        validateMetadata({ ...current, ...input.data });
        const early =
          data.earlyAccessAt === undefined
            ? current.earlyAccessAt
            : data.earlyAccessAt;
        data.publicAt = early ? carnetPublicDate(early) : null;
        validateMetadata({ ...current, ...data });
        const chapter = await tx.carnetChapter.update({
          where: { id: current.id },
          data: { ...data, revision: { increment: 1 } },
        });
        await audit(
          tx,
          adminId,
          'CARNET_UPDATED',
          'CarnetChapter',
          chapter.id,
          {
            revision: chapter.revision,
          },
        );
        return chapter;
      }
      validateMetadata(data);
      const chapter = await tx.carnetChapter.create({
        data: { ...data, createdById: adminId },
      });
      await audit(tx, adminId, 'CARNET_CREATED', 'CarnetChapter', chapter.id);
      return chapter;
    });
  } catch (error) {
    if (uploadedUrl)
      await imageStorage.delete(uploadedUrl).catch(() =>
        console.error('Carnet illustration cleanup failed', {
          code: 'CARNET_IMAGE_CLEANUP_FAILED',
        }),
      );
    throw error;
  }
}
function validateMetadata(data: {
  illustrationUrl?: string | null;
  illustrationAlt?: string | null;
  earlyAccessAt?: Date | null;
  publicAt?: Date | null;
}) {
  if (data.illustrationUrl && !data.illustrationAlt?.trim())
    throw new AdminError('Ajoutez le texte alternatif de l’illustration.');
  if (!data.illustrationUrl && data.illustrationAlt)
    throw new AdminError(
      'Ajoutez une illustration ou retirez son texte alternatif.',
    );
  assertCarnetCalendar(data.earlyAccessAt ?? null, data.publicAt ?? null);
}
/** Reversible archive. Released chapters retain their stable URL and frozen calendar on restore. */
export async function archiveCarnetChapter(
  adminId: string,
  form: FormData,
  restore = false,
) {
  whitelist(form, ['id', 'revision']);
  const chapterId = id(form)!;
  const revision = integer(form, 'revision', 0, 2147483647);
  return adminTransaction(adminId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CarnetChapter" WHERE id = ${chapterId}::uuid FOR UPDATE`;
    const current = await tx.carnetChapter.findUnique({
      where: { id: chapterId },
    });
    if (!current) throw new AdminError('Carnet introuvable.');
    if (current.revision !== revision)
      throw new AdminError(
        'Ce Carnet a été modifié. Rechargez la page avant de changer son état.',
      );
    if (restore ? current.status !== 'ARCHIVED' : current.status === 'ARCHIVED')
      throw new AdminError('Cet état est déjà appliqué.');
    const becamePublic = Boolean(
      current.releaseCampaignId &&
      current.publicAt &&
      current.publicAt <= new Date(),
    );
    if (
      !restore &&
      current.releaseCampaignId &&
      !current.publishedAt &&
      !becamePublic
    )
      throw new AdminError(
        'Annulez la campagne programmée avant d’archiver le Carnet.',
      );
    const chapter = await tx.carnetChapter.update({
      where: { id: chapterId },
      data: {
        status: restore
          ? current.publishedAt
            ? 'READY'
            : 'DRAFT'
          : 'ARCHIVED',
        ...(!restore && becamePublic && !current.publishedAt
          ? { publishedAt: current.publicAt }
          : {}),
        revision: { increment: 1 },
      },
    });
    await audit(
      tx,
      adminId,
      restore ? 'CARNET_RESTORED' : 'CARNET_ARCHIVED',
      'CarnetChapter',
      chapter.id,
      { revision: chapter.revision },
    );
    return chapter;
  });
}
export async function getAdminCarnet(id: string) {
  await requireAdmin();
  try {
    uuid(id);
  } catch {
    return null;
  }
  return getPrisma().carnetChapter.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });
}
export async function getAdminCarnets(params: SearchParams) {
  await requireAdmin();
  const db = getPrisma();
  const search = param(params, 'search').trim().slice(0, 200);
  const rawStatus = param(params, 'status');
  const status = CARNET_STATUSES.find((s) => s === rawStatus);
  const where: Prisma.CarnetChapterWhereInput = {
    ...(status ? { status } : { status: { not: 'ARCHIVED' } }),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
            { arcTitle: { contains: search, mode: 'insensitive' } },
            ...(/^\d{1,6}$/.test(search) ? [{ number: Number(search) }] : []),
          ],
        }
      : {}),
  };
  const total = await db.carnetChapter.count({ where });
  const page = Math.min(
    Math.max(1, Number.parseInt(param(params, 'page') || '1', 10) || 1),
    Math.max(1, Math.ceil(total / 25)),
  );
  const chapters = await db.carnetChapter.findMany({
    where,
    orderBy:
      param(params, 'sort') === 'modified'
        ? [{ updatedAt: 'desc' }, { number: 'asc' }]
        : [{ number: 'asc' }],
    take: 25,
    skip: (page - 1) * 25,
    select: {
      id: true,
      number: true,
      title: true,
      slug: true,
      arcTitle: true,
      arcPosition: true,
      arcTotal: true,
      status: true,
      updatedAt: true,
    },
  });
  return { chapters, total, page };
}
export async function getNextCarnetNumber() {
  await requireAdmin();
  const latest = await getPrisma().carnetChapter.aggregate({
    _max: { number: true },
  });
  return Math.min(999999, (latest._max.number ?? 0) + 1);
}

export type CarnetEditorValue = {
  id?: string;
  revision: number;
  number: number;
  title: string;
  slug: string;
  arcTitle: string;
  arcPosition: string;
  arcTotal: string;
  status: 'DRAFT' | 'READY';
  content: CarnetContent;
  illustrationUrl?: string;
  illustrationAlt?: string;
  location?: string;
  earlyAccessAt?: string;
  publicAt?: string;
  publishedAt?: string;
  releaseCampaignId?: string;
};
