import 'server-only';
import {
  assertCarnetDeparture,
  assertCarnetTestable,
  carnetTestSignature,
} from '@/lib/carnets/verification-server';
import {
  planCarnetRelease,
  renderCarnetCampaign,
} from '@/lib/carnets/campaign';
import {
  parseNewsletterDocument,
  serializeNewsletterDocument,
  newsletterIssues,
  NewsletterDocumentError,
  safeNewsletterLink,
} from './document';
import { audienceWhere, validatedCampaignSchedule } from './studio';
import { randomUUID } from 'node:crypto';
import { renderNewsletterCampaignEmail } from '@/emails/newsletter-campaign';
import { adminTransaction, audit } from '@/lib/admin/common';
import { AdminError, id, text, whitelist } from '@/lib/admin/validation';
import { linkTarget } from '@/lib/content/markdown';
import { getPrisma } from '@/lib/db/prisma';
import {
  emailSettings,
  EmailProviderError,
  resendProvider,
} from '@/lib/email/provider';
import { chapterComptoir } from '@/lib/carnets/comptoir';
import { assertEditionComplete } from '@/lib/carnets/edition';
import { appOrigin } from '@/lib/orders/access';

const CAMPAIGN_FIELDS = [
  'id',
  'internalName',
  'subject',
  'preheader',
  'heading',
  'bodyMarkdown',
  'ctaLabel',
  'ctaUrl',
  'chapterId',
] as const;

function campaignData(form: FormData) {
  whitelist(form, CAMPAIGN_FIELDS);
  const internalName = text(form, 'internalName', 120);
  const subject = text(form, 'subject', 160);
  const preheader = text(form, 'preheader', 180, false) || null;
  const heading = text(form, 'heading', 200);
  let bodyMarkdown = text(form, 'bodyMarkdown', 60000, false);
  try {
    const document = parseNewsletterDocument(bodyMarkdown);
    if (document) bodyMarkdown = serializeNewsletterDocument(document);
    else if (bodyMarkdown.length > 20000)
      throw new AdminError('Le texte dépasse 20 000 caractères.');
  } catch (error) {
    if (error instanceof NewsletterDocumentError)
      throw new AdminError(error.message);
    throw error;
  }
  const ctaLabel = text(form, 'ctaLabel', 80, false) || null;
  const ctaUrlValue = text(form, 'ctaUrl', 500, false);
  if (/[\r\n]/.test(subject))
    throw new AdminError('Objet de campagne invalide.');
  if (Boolean(ctaLabel) !== Boolean(ctaUrlValue))
    throw new AdminError(
      'Le texte et le lien du bouton doivent être renseignés ensemble.',
    );
  const target =
    ctaUrlValue && safeNewsletterLink(ctaUrlValue)
      ? linkTarget(ctaUrlValue)
      : null;
  if (ctaUrlValue && (!target || !/^\/|^https:\/\//.test(target.href)))
    throw new AdminError(
      'Le bouton doit pointer vers une page du site ou une adresse HTTPS.',
    );
  return {
    ...(form.has('chapterId')
      ? { chapterId: id(form, 'chapterId', true) ?? null }
      : {}),
    internalName,
    subject,
    preheader,
    heading,
    bodyMarkdown,
    ctaLabel,
    ctaUrl: target?.href ?? null,
  };
}

export async function saveNewsletterCampaign(adminId: string, form: FormData) {
  const campaignId = id(form, 'id', true);
  const data = campaignData(form);
  return adminTransaction(adminId, async (tx) => {
    if (data.chapterId) {
      const chapter = await tx.carnetChapter.findUnique({
        where: { id: data.chapterId },
        select: { id: true },
      });
      if (!chapter)
        throw new AdminError(
          'Carnet introuvable. Sélectionnez un chapitre existant.',
        );
    }
    if (campaignId) {
      await tx.$queryRaw`SELECT id FROM "NewsletterCampaign" WHERE id = ${campaignId}::uuid FOR UPDATE`;
      const current = await tx.newsletterCampaign.findUnique({
        where: { id: campaignId },
      });
      if (!current) throw new AdminError('Campagne introuvable.');
      if (current.status !== 'DRAFT')
        throw new AdminError(
          'Une campagne déjà mise en file ne peut plus être modifiée.',
        );
      const owner = await tx.carnetChapter.findUnique({
        where: { editionCampaignId: campaignId },
      });
      if (owner) {
        if (data.chapterId !== undefined && data.chapterId !== owner.id)
          throw new AdminError(
            'La campagne principale doit rester associée à son Carnet.',
          );
        if (
          !current.carnetCustomized &&
          (data.bodyMarkdown !== current.bodyMarkdown ||
            data.heading !== current.heading ||
            data.ctaLabel !== current.ctaLabel ||
            data.ctaUrl !== current.ctaUrl)
        )
          throw new AdminError(
            'Activez le Mode avancé depuis le Carnet avant de personnaliser sa composition.',
          );
      }
      const campaign = await tx.newsletterCampaign.update({
        where: { id: campaignId },
        data,
      });
      await audit(
        tx,
        adminId,
        'NEWSLETTER_CAMPAIGN_UPDATED',
        'NewsletterCampaign',
        campaign.id,
      );
      return campaign;
    }
    const campaign = await tx.newsletterCampaign.create({
      data: { ...data, createdById: adminId },
    });
    await audit(
      tx,
      adminId,
      'NEWSLETTER_CAMPAIGN_CREATED',
      'NewsletterCampaign',
      campaign.id,
    );
    return campaign;
  });
}

export async function queueNewsletterCampaign(adminId: string, form: FormData) {
  whitelist(form, [
    'id',
    'audience',
    'scheduledAt',
    'sendMode',
    'scheduledLocal',
    'timeZone',
    'chapterRevision',
    'campaignUpdatedAt',
  ]);
  const audience = text(form, 'audience', 30, false) || 'all';
  const where = audienceWhere(audience);
  const scheduledAt = validatedCampaignSchedule({
    mode: text(form, 'sendMode', 10, false),
    scheduledAt: text(form, 'scheduledAt', 30, false),
    local: text(form, 'scheduledLocal', 16, false),
    timeZone: text(form, 'timeZone', 80, false),
  });
  const campaignId = id(form);
  if (!campaignId) throw new AdminError('Campagne introuvable.');
  return adminTransaction(adminId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "NewsletterCampaign" WHERE id = ${campaignId}::uuid FOR UPDATE`;
    let campaign = await tx.newsletterCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new AdminError('Campagne introuvable.');
    if (
      form.has('campaignUpdatedAt') &&
      campaign.updatedAt.toISOString() !== text(form, 'campaignUpdatedAt', 30)
    )
      throw new AdminError('La campagne a changé. Rechargez la page.');
    if (campaign.status !== 'DRAFT')
      throw new AdminError('Cette campagne a déjà été mise en file.');
    if (campaign.chapterId) {
      await tx.$queryRaw`SELECT id FROM "CarnetChapter" WHERE id=${campaign.chapterId}::uuid FOR UPDATE`;
      const saved = await tx.carnetChapter.findUniqueOrThrow({
        where: { id: campaign.chapterId },
      });
      if (
        form.has('chapterRevision') &&
        String(saved.revision) !== text(form, 'chapterRevision', 10)
      )
        throw new AdminError('Le Carnet a changé. Rechargez la page.');
      if (
        saved.editionCampaignId &&
        saved.editionCampaignId !== campaign.id &&
        !saved.publishedAt
      )
        throw new AdminError(
          'La première diffusion doit utiliser la campagne principale du Carnet.',
        );

      const products = await chapterComptoir(tx, saved.id);
      await assertCarnetDeparture(tx, saved, campaign, products, scheduledAt);
      campaign = await tx.newsletterCampaign.update({
        where: { id: campaign.id },
        data: {
          carnetProducts:
            products as unknown as import('@/generated/prisma/client').Prisma.InputJsonValue,
        },
      });
      if (campaign.carnetCustomized) assertCampaignReady(campaign);
    }
    const chapter = await planCarnetRelease(tx, campaign, scheduledAt);
    if (!chapter) assertCampaignReady(campaign);
    else {
      const rendered = renderCarnetCampaign(campaign, chapter, { logo: '' });
      if (Buffer.byteLength(rendered.html) > 95000)
        throw new AdminError(
          'L’extrait dépasse 95 000 octets HTML. Réduisez-le avant l’envoi.',
        );
    }
    const subscribers = await tx.newsletterSubscriber.findMany({
      where,
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!subscribers.length)
      throw new AdminError(
        'Aucun abonné confirmé : la campagne reste en brouillon.',
      );
    await tx.newsletterCampaignDelivery.createMany({
      data: subscribers.map((subscriber) => ({
        campaignId,
        subscriberId: subscriber.id,
        recipient: subscriber.email,
        nextAttemptAt: scheduledAt,
      })),
    });
    const queued = await tx.newsletterCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'QUEUED',
        recipientCount: subscribers.length,
        queuedAt: new Date(),
        scheduledAt,
        sendImmediately: text(form, 'sendMode', 10, false) === 'now',
      },
    });
    await audit(
      tx,
      adminId,
      'NEWSLETTER_CAMPAIGN_QUEUED',
      'NewsletterCampaign',
      campaignId,
      {
        recipientCount: subscribers.length,
        audience,
        scheduledAt: scheduledAt.toISOString(),
      },
    );
    return queued;
  });
}

export async function sendNewsletterCampaignTest(
  admin: { id: string; email: string },
  form: FormData,
) {
  whitelist(form, ['id', 'chapterRevision', 'campaignUpdatedAt']);
  const campaignId = id(form);
  if (!campaignId) throw new AdminError('Campagne introuvable.');
  const campaign = await getPrisma().newsletterCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new AdminError('Campagne introuvable.');
  if (
    form.has('campaignUpdatedAt') &&
    campaign.updatedAt.toISOString() !== text(form, 'campaignUpdatedAt', 30)
  )
    throw new AdminError('La campagne a changé. Rechargez la page.');
  if (process.env.EMAILS_ENABLED !== 'true')
    throw new AdminError('Les e-mails sont désactivés dans cet environnement.');
  try {
    const settings = emailSettings();
    const urls = { logo: `${appOrigin()}/assets/brand/logo-header-no-bg.png` };
    const chapter = campaign.chapterId
      ? await getPrisma().carnetChapter.findUniqueOrThrow({
          where: { id: campaign.chapterId },
        })
      : null;
    if (
      chapter &&
      form.has('chapterRevision') &&
      String(chapter.revision) !== text(form, 'chapterRevision', 10)
    )
      throw new AdminError('Le Carnet a changé. Rechargez la page.');
    if (chapter?.editionCampaignId === campaign.id)
      assertEditionComplete(chapter, campaign);
    const products =
      chapter && campaign.status === 'DRAFT'
        ? await chapterComptoir(getPrisma(), chapter.id)
        : null;
    const testedProducts =
      products ??
      (Array.isArray(campaign.carnetProducts)
        ? (campaign.carnetProducts as unknown as import('@/lib/carnets/comptoir').CarnetProduct[])
        : []);
    if (chapter) assertCarnetTestable(chapter, campaign, testedProducts);
    const rendered = chapter
      ? renderCarnetCampaign(
          {
            ...campaign,
            ...(products
              ? {
                  carnetProducts:
                    products as unknown as import('@/generated/prisma/client').Prisma.JsonValue,
                }
              : {}),
          },
          chapter,
          urls,
        )
      : renderNewsletterCampaignEmail(
          { ...campaign, campaignId: campaign.id },
          urls,
        );
    await resendProvider().send(
      {
        from: settings.from,
        to: [settings.testRecipient ?? admin.email],
        ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
        subject: `[TEST] ${rendered.subject}`,
        html: rendered.html,
        text: rendered.text,
      },
      `caldera-newsletter:test:${campaignId}:${randomUUID()}`,
    );
    await adminTransaction(admin.id, (tx) =>
      audit(
        tx,
        admin.id,
        'NEWSLETTER_CAMPAIGN_TEST_SENT',
        'NewsletterCampaign',
        campaignId,
        {
          ...(chapter
            ? {
                carnetTestSignature: carnetTestSignature(
                  chapter,
                  campaign,
                  testedProducts,
                ),
              }
            : {}),
          chapterRevision: chapter?.revision ?? null,
          campaignUpdatedAt: campaign.updatedAt.toISOString(),
        },
      ),
    );
  } catch (error) {
    if (error instanceof AdminError) throw error;
    throw new AdminError(
      error instanceof EmailProviderError
        ? `Envoi test refusé (${error.code}).`
        : 'Envoi test impossible.',
    );
  }
}

/** Incomplete blocks may be saved as drafts, never sent accidentally. */
export function assertCampaignReady(campaign: {
  bodyMarkdown: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
}) {
  const document = parseNewsletterDocument(campaign.bodyMarkdown);
  if (document) {
    const issues = newsletterIssues(document);
    if (issues.length) throw new AdminError(issues[0]);
  }
  if (
    Boolean(campaign.ctaLabel) !== Boolean(campaign.ctaUrl) ||
    (campaign.ctaUrl && !safeNewsletterLink(campaign.ctaUrl))
  )
    throw new AdminError('Le bouton principal est incomplet ou invalide.');
  const htmlSize = Buffer.byteLength(
    renderNewsletterCampaignEmail(
      { subject: '', preheader: null, heading: '', ...campaign },
      { logo: '' },
    ).html,
  );
  if (htmlSize > 95000)
    throw new AdminError(
      'Cette campagne dépasse la limite de sécurité de 95 000 octets HTML. Réduisez son contenu avant l’envoi.',
    );
}
export async function duplicateNewsletterCampaign(
  adminId: string,
  form: FormData,
) {
  whitelist(form, ['id']);
  const campaignId = id(form)!;
  return adminTransaction(adminId, async (tx) => {
    const source = await tx.newsletterCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!source) throw new AdminError('Campagne introuvable.');
    const campaign = await tx.newsletterCampaign.create({
      data: {
        internalName: `${source.internalName.slice(0, 109)} — copie`,
        subject: source.subject,
        preheader: source.preheader,
        heading: source.heading,
        bodyMarkdown: source.bodyMarkdown,
        ctaLabel: source.ctaLabel,
        ctaUrl: source.ctaUrl,
        chapterId: source.chapterId,
        carnetCustomized: source.carnetCustomized,
        createdById: adminId,
      },
    });
    await audit(
      tx,
      adminId,
      'NEWSLETTER_CAMPAIGN_DUPLICATED',
      'NewsletterCampaign',
      campaign.id,
      { sourceId: campaignId },
    );
    return campaign;
  });
}
export async function cancelNewsletterCampaign(
  adminId: string,
  form: FormData,
) {
  whitelist(form, ['id']);
  const campaignId = id(form)!;
  return adminTransaction(adminId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "NewsletterCampaign" WHERE id = ${campaignId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "NewsletterCampaignDelivery" WHERE "campaignId" = ${campaignId}::uuid FOR UPDATE`;
    const campaign = await tx.newsletterCampaign.findUnique({
      where: { id: campaignId },
    });
    if (
      !campaign ||
      campaign.status !== 'QUEUED' ||
      (await tx.newsletterCampaignDelivery.count({
        where: { campaignId, attemptCount: { gt: 0 } },
      }))
    )
      throw new AdminError(
        'L’envoi a déjà commencé : il ne peut plus être remis en brouillon.',
      );
    if (campaign.chapterId) {
      await tx.$queryRaw`SELECT id FROM "CarnetChapter" WHERE id=${campaign.chapterId}::uuid FOR UPDATE`;
      const chapter = await tx.carnetChapter.findUnique({
        where: { id: campaign.chapterId },
        select: { releaseCampaignId: true, publicAt: true },
      });
      if (
        chapter?.releaseCampaignId === campaignId &&
        chapter.publicAt &&
        chapter.publicAt <= new Date()
      )
        throw new AdminError(
          'Ce Carnet est déjà public : son calendrier ne peut plus être annulé.',
        );
      await tx.carnetChapter.updateMany({
        where: {
          id: campaign.chapterId,
          releaseCampaignId: campaignId,
          publishedAt: null,
        },
        data: {
          releaseCampaignId: null,
          earlyAccessAt: null,
          publicAt: null,
          revision: { increment: 1 },
        },
      });
    }
    await tx.newsletterCampaignDelivery.deleteMany({ where: { campaignId } });
    await tx.newsletterCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'DRAFT',
        queuedAt: null,
        recipientCount: 0,
        scheduledAt: null,
        sendImmediately: false,
      },
    });
    await audit(
      tx,
      adminId,
      'NEWSLETTER_CAMPAIGN_CANCELED',
      'NewsletterCampaign',
      campaignId,
    );
  });
}
