import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { AdminForm } from '@/components/admin/AdminForm';
import { PageHeader } from '@/components/admin/AdminUI';
import { getPrisma } from '@/lib/db/prisma';
import { invoiceSettings } from '@/lib/invoices/admin';
import { saveInvoiceSettingsAction } from '@/lib/invoices/admin-actions';
import styles from '@/components/admin/Admin.module.scss';
import { requireAdmin } from '@/lib/admin/auth';

export default async function InvoiceSettingsPage() {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const settings = await invoiceSettings(getPrisma());
  const field = (
    name: keyof typeof settings,
    label: string,
    options: {
      required?: boolean;
      placeholder?: string;
      maxLength?: number;
    } = {},
  ) => (
    <label>
      {label}
      <input
        name={name}
        defaultValue={String(settings[name] ?? '')}
        required={options.required}
        placeholder={options.placeholder}
        maxLength={options.maxLength ?? 160}
      />
    </label>
  );
  return (
    <>
      <PageHeader
        title="Mentions des factures"
        description="Identité imprimée sur les factures et avoirs. Chaque document garde les mentions en vigueur à son émission : une modification ne concerne que les suivants."
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/factures"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Factures
        </Link>
      </PageHeader>
      <section className={styles.card}>
        <AdminForm
          action={saveInvoiceSettingsAction}
          confirm="Enregistrer ces mentions ? Elles figureront sur toutes les prochaines factures."
        >
          <div className={styles.fields}>
            {field('legalName', 'Dénomination sociale', { required: true })}
            {field('tradeName', 'Nom commercial', { required: true })}
            {field('legalForm', 'Forme juridique', {
              required: true,
              placeholder: 'SASU',
            })}
            {field('shareCapital', 'Capital social', {
              placeholder: '1 000 €',
            })}
            {field('street', 'Adresse du siège', { required: true })}
            {field('postalCode', 'Code postal', {
              required: true,
              maxLength: 12,
            })}
            {field('city', 'Ville', { required: true })}
            {field('country', 'Pays', { required: true })}
            {field('siren', 'SIREN (9 chiffres)', { maxLength: 11 })}
            {field('siret', 'SIRET du siège (14 chiffres)', { maxLength: 17 })}
            {field('rcsCity', 'Ville du RCS', { placeholder: 'Lyon' })}
            {field('email', 'E-mail de contact', { required: true })}
            <label>
              Régime de TVA
              <select name="vatRegime" defaultValue={settings.vatRegime}>
                <option value="FRANCHISE">
                  Franchise en base (art. 293 B du CGI) : pas de TVA
                </option>
                <option value="STANDARD">Assujetti : TVA facturée</option>
              </select>
            </label>
            {field('vatNumber', 'N° de TVA intracommunautaire', {
              maxLength: 20,
              placeholder: 'FR…',
            })}
            <label>
              Taux de TVA hors Stripe Tax (%)
              <input
                name="defaultVatRate"
                inputMode="decimal"
                required
                defaultValue={settings.defaultVatRate
                  .toFixed(2)
                  .replace('.', ',')}
              />
            </label>
            <label className={styles.full}>
              Texte en bas de facture — facultatif
              <textarea
                name="footer"
                maxLength={1000}
                defaultValue={settings.footer ?? ''}
                placeholder="ex. Merci pour votre confiance."
              />
            </label>
            <p className={`${styles.full} ${styles.muted}`}>
              En franchise, chaque facture porte « TVA non applicable, article
              293 B du Code général des impôts » et aucun montant de TVA. En
              passant au régime assujetti, les prix affichés restent TTC : la
              TVA est extraite de chaque ligne (par Stripe Tax s’il est activé
              dans Fiscalité, sinon au taux ci-dessus).
            </p>
          </div>
        </AdminForm>
      </section>
    </>
  );
}
