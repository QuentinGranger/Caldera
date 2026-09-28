import 'server-only';
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
  const bodyMarkdown = text(form, 'bodyMarkdown', 20000);
  const ctaLabel = text(form, 'ctaLabel', 80, false) || null;
  const ctaUrlValue = text(form, 'ctaUrl', 500, false);
  if (/[\r\n]/.test(subject))
    throw new AdminError('Objet de campagne invalide.');
  if (Boolean(ctaLabel) !== Boolean(ctaUrlValue))
    throw new AdminError(
      'Le texte et le lien du bouton doivent être renseignés ensemble.',
    );
  const target = ctaUrlValue ? linkTarget(ctaUrlValue) : null;
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
  whitelist(form, ['id']);
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
    const subscribers = await tx.newsletterSubscriber.findMany({
      where: { status: 'ACTIVE' },
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
    const rendered = renderNewsletterCampaignEmail(campaign, {
      logo: `${appOrigin()}/assets/brand/logo-header-no-bg.png`,
    });
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
