import { carnetChecklist } from '@/lib/carnets/readiness';
import { carnetVerificationContext } from '@/lib/carnets/verification-server';
import { chapterComptoir } from '@/lib/carnets/comptoir';
import { parseCarnetContent, deriveCarnet } from '@/lib/carnets/content';
import { CarnetDiffusion } from '@/components/admin/carnets/CarnetDiffusion';
import { getNewsletterStudioData } from '@/lib/newsletter/studio';
import {
  documentFromLegacy,
  newsletterIssues,
} from '@/lib/newsletter/document';
import { NewsletterCampaignDelivery } from '@/components/admin/NewsletterCampaignDelivery';
import { getPrisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { NewsletterCampaignEditor } from '@/components/admin/NewsletterCampaignEditor';
import { AdminForm } from '@/components/admin/AdminForm';
import { Badge, PageHeader } from '@/components/admin/AdminUI';
import { formatDate } from '@/lib/admin/format';
import { getAdminNewsletterCampaign } from '@/lib/admin/queries';
import {
  duplicateNewsletterCampaignAction,
  cancelNewsletterCampaignAction,
  saveNewsletterCampaignAction,
  sendNewsletterCampaignTestAction,
} from '@/lib/newsletter/admin-actions';
import styles from '@/components/admin/Admin.module.scss';

export default async function NewsletterCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaign, studio] = await Promise.all([
    getAdminNewsletterCampaign(id),
    getNewsletterStudioData(),
  ]);
  if (!campaign) notFound();
  const db = getPrisma();
  const [schedule, attempted, delivered, tracked, opened, clicked] =
    await Promise.all([
      db.newsletterCampaignDelivery.aggregate({
        where: { campaignId: id, status: 'PENDING' },
        _min: { nextAttemptAt: true },
      }),
      db.newsletterCampaignDelivery.count({
        where: { campaignId: id, attemptCount: { gt: 0 } },
      }),
      db.newsletterCampaignDelivery.count({
        where: { campaignId: id, deliveredAt: { not: null } },
      }),
      db.newsletterCampaignDelivery.count({
        where: { campaignId: id, status: 'SENT', trackingEnabled: true },
      }),
      db.newsletterCampaignDelivery.count({
        where: {
          campaignId: id,
          trackingEnabled: true,
          openedAt: { not: null },
        },
      }),
      db.newsletterCampaignDelivery.count({
        where: {
          campaignId: id,
          trackingEnabled: true,
          clickedAt: { not: null },
        },
      }),
    ]);
  const issues = campaign.carnetCustomized
    ? newsletterIssues(documentFromLegacy(campaign.bodyMarkdown))
    : campaign.chapter
      ? ['READY', 'EARLY_ACCESS', 'PUBLIC'].includes(campaign.chapter.status)
        ? []
        : ['Le Carnet doit être prêt éditorialement.']
      : newsletterIssues(documentFromLegacy(campaign.bodyMarkdown));
  const excerpt = campaign.chapter
    ? deriveCarnet(parseCarnetContent(campaign.chapter.content)).excerpt
    : null;
  const carnetProducts = campaign.chapter
    ? campaign.status !== 'DRAFT' && Array.isArray(campaign.carnetProducts)
      ? (campaign.carnetProducts as unknown as import('@/lib/carnets/comptoir').CarnetProduct[])
      : await chapterComptoir(db, campaign.chapter.id, false)
    : [];
  if (campaign.chapter && campaign.status === 'DRAFT') {
    const context = await carnetVerificationContext(
      db,
      campaign.chapter,
      campaign,
      carnetProducts,
    );
    const review = carnetChecklist(
      campaign.chapter,
      campaign,
      carnetProducts,
      context,
    );
    issues.push(
      ...review.blocking
        .filter((c) => !['access', 'public'].includes(c.key))
        .map((c) => `${c.label} — ${c.detail}`),
    );
  }
  const value = {
    id: campaign.id,
    internalName: campaign.internalName,
    subject: campaign.subject,
    preheader: campaign.preheader ?? '',
    heading: campaign.heading,
    bodyMarkdown: campaign.bodyMarkdown,
    ctaLabel: campaign.ctaLabel ?? '',
    ctaUrl: campaign.ctaUrl ?? '',
    carnetCustomized: campaign.carnetCustomized,
    editionOwned: Boolean(campaign.chapter?.editionCampaignId === campaign.id),
    chapterId: campaign.chapterId ?? '',
    ...(campaign.chapter && excerpt
      ? {
          carnetSource: {
            products: carnetProducts,
            illustration: campaign.chapter.illustrationUrl
              ? {
                  src: campaign.chapter.illustrationUrl,
                  alt: campaign.chapter.illustrationAlt ?? '',
                }
              : undefined,
            id: campaign.chapter.id,
            number: campaign.chapter.number,
            title: campaign.chapter.title,
            slug: campaign.chapter.slug,
            html: excerpt.html,
            text: excerpt.text,
          },
        }
      : {}),
  };
  return (
    <>
      <PageHeader title={campaign.internalName} description={campaign.subject}>
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/newsletter"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Newsletter
        </Link>
      </PageHeader>
      <section className={styles.card} aria-label="État de la campagne">
        <div className={styles.inline}>
          <Badge value={campaign.status} />
          <span>
            Créée le {formatDate(campaign.createdAt)} par{' '}
            {campaign.createdBy.name}
          </span>
        </div>
        {campaign.status !== 'DRAFT' && (
          <p>
            <strong>{campaign.recipientCount}</strong> destinataires figés ·{' '}
            <strong>{campaign.deliveryCounts.SENT ?? 0}</strong> envoyés ·{' '}
            <strong>{campaign.deliveryCounts.FAILED ?? 0}</strong> en échec ·{' '}
            <strong>{campaign.deliveryCounts.SKIPPED ?? 0}</strong> ignorés
            après désinscription
          </p>
        )}
      </section>
      <NewsletterCampaignEditor
        revision={`${campaign.id}:${campaign.updatedAt.toISOString()}`}
        products={studio.products}
        chapters={
          campaign.chapter &&
          !studio.chapters.some((c) => c.id === campaign.chapterId)
            ? [campaign.chapter, ...studio.chapters]
            : studio.chapters
        }
        value={value}
        action={saveNewsletterCampaignAction}
        readOnly={campaign.status !== 'DRAFT'}
      />
      {campaign.chapter && (
        <section className={styles.card} aria-label="Source éditoriale">
          <h2>Carnet associé</h2>
          <Link href={`/admin/carnets/${campaign.chapter.id}`}>
            #{String(campaign.chapter.number).padStart(3, '0')} ·{' '}
            {campaign.chapter.title}
          </Link>
          <p>
            {campaign.carnetCustomized
              ? 'Email personnalisé : cette composition est indépendante. Le chapitre web reste géré dans le Carnet, sans synchronisation automatique.'
              : 'Le titre, l’extrait et le bouton de l’email proviennent du Carnet enregistré.'}{' '}
            La programmation active l’avant-première et la publication publique
            automatique.
          </p>
          {(campaign.status !== 'DRAFT' || campaign.chapter.publishedAt) && (
            <CarnetDiffusion
              early={campaign.chapter.earlyAccessAt?.toISOString()}
              publicAt={campaign.chapter.publicAt?.toISOString()}
              frozen={Boolean(campaign.chapter.publishedAt)}
              campaignId={campaign.chapter.releaseCampaignId ?? undefined}
            />
          )}
        </section>
      )}
      <section className={styles.card} aria-labelledby="verifications-campagne">
        <h2 id="verifications-campagne">Tester et réutiliser</h2>
        <p>
          Le test utilise la dernière version enregistrée et part vers votre
          adresse d’administration. Relisez-le dans votre boîte mail avant
          l’envoi définitif.
        </p>
        <div className={styles.grid}>
          <AdminForm
            action={sendNewsletterCampaignTestAction}
            guard={false}
            requireSaved
            submit="M’envoyer un test"
          >
            <input type="hidden" name="id" value={campaign.id} />
          </AdminForm>
          <AdminForm
            action={duplicateNewsletterCampaignAction}
            guard={false}
            requireSaved
            submit="Dupliquer en brouillon"
          >
            <input type="hidden" name="id" value={campaign.id} />
          </AdminForm>
        </div>
      </section>
      {campaign.chapter && (
        <p className={styles.card}>
          <Link
            href={`/admin/carnets/${campaign.chapter.id}#carnet-verification`}
          >
            Ouvrir la checklist Carnet et envoyer un test
          </Link>
        </p>
      )}
      {campaign.status === 'DRAFT' ? (
        <NewsletterCampaignDelivery
          id={campaign.id}
          audiences={studio.audiences}
          issues={issues}
          carnet={Boolean(campaign.chapter)}
          calendarFrozen={Boolean(campaign.chapter?.publishedAt)}
        />
      ) : (
        <section className={styles.card}>
          <h2>Suivi de l’envoi</h2>
          {schedule._min.nextAttemptAt && (
            <p>
              Prochain départ éligible :{' '}
              <strong>{formatDate(schedule._min.nextAttemptAt)}</strong> (heure
              de Paris).
            </p>
          )}
          <div className={styles.grid}>
            <div>
              <h3>{delivered}</h3>
              <p>Délivrés confirmés par le fournisseur</p>
            </div>
            <div>
              <h3>{opened}</h3>
              <p>
                Ouvertures uniques ·{' '}
                {tracked ? `${Math.round((opened / tracked) * 100)} %` : '—'}
              </p>
            </div>
            <div>
              <h3>{clicked}</h3>
              <p>
                Clics uniques ·{' '}
                {tracked ? `${Math.round((clicked / tracked) * 100)} %` : '—'}
              </p>
            </div>
          </div>
          <p>
            <small>
              Les taux utilisent uniquement les {tracked} envois avec suivi
              autorisé. Les protections des messageries peuvent modifier les
              mesures d’ouverture.
            </small>
          </p>
          {campaign.status === 'QUEUED' && attempted === 0 && (
            <AdminForm
              action={cancelNewsletterCampaignAction}
              guard={false}
              submit="Annuler et revenir au brouillon"
              confirm="Annuler les envois en attente et rendre cette campagne modifiable ? Cette action est refusée dès que le premier envoi commence."
            >
              <input type="hidden" name="id" value={campaign.id} />
            </AdminForm>
          )}
        </section>
      )}
    </>
  );
}
