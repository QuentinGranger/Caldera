import 'server-only';
import type { CarnetChapter, Prisma } from '@/generated/prisma/client';
import { adminTransaction, audit } from '@/lib/admin/common';
import {
  AdminError,
  id,
  integer,
  text,
  whitelist,
} from '@/lib/admin/validation';
import { chapterComptoir, loadComptoir } from './comptoir';
import { carnetEmailSnapshot } from './email';
import { parseCarnetContent, carnetUrl } from './content';
import { assertCarnetReady } from './campaign';
/** Same lock order as queue/worker: campaign, then chapter. Recheck after chapter lock. */
export async function lockCarnetEdition(
  tx: Prisma.TransactionClient,
  chapterId: string,
) {
  const before = await tx.carnetChapter.findUnique({
    where: { id: chapterId },
    select: { editionCampaignId: true },
  });
  if (before?.editionCampaignId)
    await tx.$queryRaw`SELECT id FROM "NewsletterCampaign" WHERE id=${before.editionCampaignId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "CarnetChapter" WHERE id=${chapterId}::uuid FOR UPDATE`;
  const current = await tx.carnetChapter.findUnique({
    where: { id: chapterId },
  });
  if (current?.editionCampaignId !== before?.editionCampaignId)
    throw new AdminError(
      'L’édition a changé dans un autre onglet. Rechargez la page.',
    );
  if (current?.editionCampaignId) {
    const campaign = await tx.newsletterCampaign.findUniqueOrThrow({
      where: { id: current.editionCampaignId },
    });
    if (campaign.chapterId !== chapterId || campaign.status !== 'DRAFT')
      throw new AdminError(
        'Cette édition est déjà engagée dans une diffusion ou sa campagne est incohérente.',
      );
  }
  return current;
}
export async function saveCarnetEdition(
  tx: Prisma.TransactionClient,
  adminId: string,
  chapter: CarnetChapter,
  input: {
    productIds?: string[];
    email?: { subject: string; preheader: string | null };
  },
) {
  if (input.productIds) {
    await loadComptoir(tx, input.productIds);
    await tx.carnetComptoirProduct.deleteMany({
      where: { chapterId: chapter.id },
    });
    if (input.productIds.length)
      await tx.carnetComptoirProduct.createMany({
        data: input.productIds.map((productId, position) => ({
          chapterId: chapter.id,
          productId,
          position,
        })),
      });
  }
  if (!input.email) return chapter;
  if (/[\r\n]/.test(input.email.subject))
    throw new AdminError('Objet email invalide.');
  const data = {
    subject: input.email.subject,
    preheader: input.email.preheader,
    scheduledAt: chapter.earlyAccessAt,
  };
  if (chapter.editionCampaignId) {
    await tx.newsletterCampaign.update({
      where: { id: chapter.editionCampaignId },
      data: {
        ...data,
        ...(!(
          await tx.newsletterCampaign.findUniqueOrThrow({
            where: { id: chapter.editionCampaignId },
          })
        ).carnetCustomized
          ? { heading: chapter.title }
          : {}),
      },
    });
    return chapter;
  }
  const campaign = await tx.newsletterCampaign.create({
    data: {
      ...data,
      internalName:
        `Carnet #${String(chapter.number).padStart(3, '0')} — ${chapter.title}`.slice(
          0,
          120,
        ),
      heading: chapter.title,
      bodyMarkdown: '',
      chapterId: chapter.id,
      createdById: adminId,
    },
  });
  const saved = await tx.carnetChapter.update({
    where: { id: chapter.id },
    data: { editionCampaignId: campaign.id },
  });
  await audit(
    tx,
    adminId,
    'CARNET_EDITION_CREATED',
    'NewsletterCampaign',
    campaign.id,
    { chapterId: chapter.id },
  );
  return saved;
}
export function assertEditionComplete(
  chapter: CarnetChapter,
  campaign: { subject: string; preheader: string | null },
) {
  assertCarnetReady(chapter);
  if (!chapter.illustrationUrl || !chapter.illustrationAlt?.trim())
    throw new AdminError(
      'Ajoutez une image principale et son texte alternatif.',
    );
  if (!campaign.subject.trim() || !campaign.preheader?.trim())
    throw new AdminError('Renseignez l’objet email et le preheader.');
}
export async function customizeCarnetEdition(adminId: string, form: FormData) {
  whitelist(form, ['id', 'revision', 'campaignUpdatedAt']);
  const chapterId = id(form)!,
    revision = integer(form, 'revision', 0, 2147483647),
    stamp = text(form, 'campaignUpdatedAt', 30);
  return adminTransaction(adminId, async (tx) => {
    const chapter = await lockCarnetEdition(tx, chapterId);
    if (!chapter || !chapter.editionCampaignId)
      throw new AdminError('Enregistrez d’abord l’édition.');
    if (
      chapter.revision !== revision ||
      chapter.releaseCampaignId ||
      chapter.publishedAt ||
      !['DRAFT', 'READY'].includes(chapter.status)
    )
      throw new AdminError(
        'Version périmée ou édition non modifiable. Rechargez la page.',
      );
    const campaign = await tx.newsletterCampaign.findUniqueOrThrow({
      where: { id: chapter.editionCampaignId },
    });
    if (campaign.updatedAt.toISOString() !== stamp)
      throw new AdminError(
        'La campagne a changé. Rechargez avant de continuer.',
      );
    if (campaign.carnetCustomized) return campaign;
    const excerpt = parseCarnetContent(chapter.content);
    if (!excerpt.document.content.some((b) => b.type === 'newsletterCut'))
      throw new AdminError(
        'Placez la coupure avant de créer la composition personnalisée.',
      );
    const products = await chapterComptoir(tx, chapterId);
    const updated = await tx.newsletterCampaign.update({
      where: { id: campaign.id },
      data: {
        carnetCustomized: true,
        heading: chapter.title,
        bodyMarkdown: carnetEmailSnapshot(
          { ...chapter, content: excerpt },
          products,
        ),
        ctaLabel: null,
        ctaUrl: null,
      },
    });
    await audit(
      tx,
      adminId,
      'CARNET_EMAIL_CUSTOMIZED',
      'NewsletterCampaign',
      campaign.id,
      { chapterId },
    );
    return updated;
  });
}
export async function restoreAutomaticCarnetEdition(
  adminId: string,
  form: FormData,
) {
  whitelist(form, ['id', 'revision', 'campaignUpdatedAt']);
  const chapterId = id(form)!,
    revision = integer(form, 'revision', 0, 2147483647),
    stamp = text(form, 'campaignUpdatedAt', 30);
  return adminTransaction(adminId, async (tx) => {
    const chapter = await lockCarnetEdition(tx, chapterId);
    if (
      !chapter?.editionCampaignId ||
      chapter.revision !== revision ||
      chapter.releaseCampaignId ||
      chapter.publishedAt ||
      !['DRAFT', 'READY'].includes(chapter.status)
    )
      throw new AdminError('Version périmée ou édition non modifiable.');
    const campaign = await tx.newsletterCampaign.findUniqueOrThrow({
      where: { id: chapter.editionCampaignId },
    });
    if (campaign.updatedAt.toISOString() !== stamp)
      throw new AdminError('La campagne a changé. Rechargez la page.');
    await tx.newsletterCampaign.update({
      where: { id: campaign.id },
      data: {
        carnetCustomized: false,
        bodyMarkdown: '',
        heading: chapter.title,
        ctaLabel: 'Continuer l’expédition',
        ctaUrl: carnetUrl(chapter.slug),
      },
    });
    await audit(
      tx,
      adminId,
      'CARNET_EMAIL_AUTOMATIC_RESTORED',
      'NewsletterCampaign',
      campaign.id,
      { chapterId },
    );
    return chapter;
  });
}
