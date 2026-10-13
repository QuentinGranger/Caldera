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

export async function saveCarnetChapter(adminId: string, form: FormData) {
  const input = carnetInput(form);
  return adminTransaction(adminId, async (tx) => {
    const data = {
      ...input.data,
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
      if (current.revision !== input.revision)
        throw new AdminError(
          'Ce Carnet a été modifié dans un autre onglet. Conservez votre texte, puis rechargez pour consulter la version enregistrée.',
        );
      const chapter = await tx.carnetChapter.update({
        where: { id: current.id },
        data: { ...data, revision: { increment: 1 } },
      });
      await audit(tx, adminId, 'CARNET_UPDATED', 'CarnetChapter', chapter.id, {
        revision: chapter.revision,
      });
      return chapter;
    }
    const chapter = await tx.carnetChapter.create({
      data: { ...data, createdById: adminId },
    });
    await audit(tx, adminId, 'CARNET_CREATED', 'CarnetChapter', chapter.id);
    return chapter;
  });
}
/** Reversible deletion: no narrative is permanently removed. Restoring always returns to draft. */
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
    const chapter = await tx.carnetChapter.update({
      where: { id: chapterId },
      data: {
        status: restore ? 'DRAFT' : 'ARCHIVED',
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
};
