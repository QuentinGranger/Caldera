import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/admin/AdminUI';
import { NewsletterCampaignEditor } from '@/components/admin/NewsletterCampaignEditor';
import { saveNewsletterCampaignAction } from '@/lib/newsletter/admin-actions';
import styles from '@/components/admin/Admin.module.scss';

export default function NewNewsletterCampaignPage() {
  return (
    <>
      <PageHeader
        title="Nouvelle campagne"
        description="Préparez le contenu, enregistrez le brouillon, puis envoyez-vous un test avant de choisir les destinataires confirmés."
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/newsletter"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Newsletter
        </Link>
      </PageHeader>
      <NewsletterCampaignEditor
        action={saveNewsletterCampaignAction}
        value={{
          internalName: '',
          subject: '',
          preheader: '',
          heading: '',
          bodyMarkdown: '',
          ctaLabel: '',
          ctaUrl: '',
        }}
      />
    </>
  );
}
