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
  const issues = newsletterIssues(documentFromLegacy(campaign.bodyMarkdown));
  const value = {
    id: campaign.id,
    internalName: campaign.internalName,
    subject: campaign.subject,
    preheader: campaign.preheader ?? '',
    heading: campaign.heading,
    bodyMarkdown: campaign.bodyMarkdown,
    ctaLabel: campaign.ctaLabel ?? '',
    ctaUrl: campaign.ctaUrl ?? '',
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
        value={value}
        action={saveNewsletterCampaignAction}
        readOnly={campaign.status !== 'DRAFT'}
      />
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
      {campaign.status === 'DRAFT' ? (
        <NewsletterCampaignDelivery
          id={campaign.id}
          audiences={studio.audiences}
          issues={issues}
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
