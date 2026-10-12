import 'server-only';
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
] as const;

function campaignData(form: FormData) {
  whitelist(form, CAMPAIGN_FIELDS);
  const internalName = text(form, 'internalName', 120);
  const subject = text(form, 'subject', 160);
  const preheader = text(form, 'preheader', 180, false) || null;
  const heading = text(form, 'heading', 160);
  let bodyMarkdown = text(form, 'bodyMarkdown', 60000);
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
    const campaign = await tx.newsletterCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new AdminError('Campagne introuvable.');
    if (campaign.status !== 'DRAFT')
      throw new AdminError('Cette campagne a déjà été mise en file.');
    assertCampaignReady(campaign);
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
  whitelist(form, ['id']);
  const campaignId = id(form);
  if (!campaignId) throw new AdminError('Campagne introuvable.');
  const campaign = await getPrisma().newsletterCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new AdminError('Campagne introuvable.');
  if (process.env.EMAILS_ENABLED !== 'true')
    throw new AdminError('Les e-mails sont désactivés dans cet environnement.');
  try {
    const settings = emailSettings();
    const rendered = renderNewsletterCampaignEmail(
      { ...campaign, campaignId: campaign.id },
      {
        logo: `${appOrigin()}/assets/brand/logo-header-no-bg.png`,
      },
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
    await tx.newsletterCampaignDelivery.deleteMany({ where: { campaignId } });
    await tx.newsletterCampaign.update({
      where: { id: campaignId },
      data: { status: 'DRAFT', queuedAt: null, recipientCount: 0 },
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
