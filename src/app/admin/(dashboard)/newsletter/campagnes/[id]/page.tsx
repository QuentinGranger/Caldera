import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { NewsletterCampaignEditor } from '@/components/admin/NewsletterCampaignEditor';
import { AdminForm } from '@/components/admin/AdminForm';
import { Badge, PageHeader } from '@/components/admin/AdminUI';
import { formatDate } from '@/lib/admin/format';
import {
  getAdminNewsletter,
  getAdminNewsletterCampaign,
} from '@/lib/admin/queries';
import {
  queueNewsletterCampaignAction,
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
  const [campaign, audience] = await Promise.all([
    getAdminNewsletterCampaign(id),
    getAdminNewsletter({ status: 'ACTIVE' }),
  ]);
  if (!campaign) notFound();
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
        value={value}
        action={saveNewsletterCampaignAction}
        readOnly={campaign.status !== 'DRAFT'}
      />
      <section className={styles.card} aria-labelledby="verifications-campagne">
        <h2 id="verifications-campagne">Vérification et envoi</h2>
        <p>
          L’envoi test part uniquement vers{' '}
          <strong>{campaign.createdBy.email}</strong>. La mise en file
          définitive inclut actuellement <strong>{audience.total}</strong>{' '}
          abonné{audience.total > 1 ? 's' : ''} confirmé
          {audience.total > 1 ? 's' : ''}.
        </p>
        <div className={styles.grid}>
          <div className={styles.card}>
            <h3>1. Tester</h3>
            <p>
              Contrôlez l’objet, les liens et l’affichage depuis votre vraie
              boîte mail.
            </p>
            <AdminForm
              action={sendNewsletterCampaignTestAction}
              submit="M’envoyer un test"
            >
              <input type="hidden" name="id" value={campaign.id} />
            </AdminForm>
          </div>
          <div className={styles.card}>
            <h3>2. Envoyer</h3>
            {campaign.status === 'DRAFT' ? (
              <>
                <p>
                  La liste est figée au clic. Les désabonnements survenus avant
                  chaque envoi restent respectés.
                </p>
                <AdminForm
                  action={queueNewsletterCampaignAction}
                  submit={`Envoyer à ${audience.total} abonné${audience.total > 1 ? 's' : ''}`}
                  confirm={`Cette campagne sera mise en file pour ${audience.total} abonné${audience.total > 1 ? 's' : ''}. Son contenu ne pourra plus être modifié.`}
                >
                  <input type="hidden" name="id" value={campaign.id} />
                </AdminForm>
              </>
            ) : (
              <p>
                La campagne est déjà figée. Le planificateur traite les envois
                par petits lots et reprend les erreurs temporaires.
              </p>
            )}
          </div>
        </div>
        <small>
          Avec le quota gratuit actuel, la newsletter utilise au plus 80 envois
          sur 24 heures afin de conserver une marge pour les confirmations et
          les commandes.
        </small>
      </section>
    </>
  );
}
