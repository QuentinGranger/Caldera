import Link from 'next/link';
import { AdminForm } from '@/components/admin/AdminForm';
import {
  AdminTable,
  IntegrityWarning,
  PageHeader,
} from '@/components/admin/AdminUI';
import { euros } from '@/lib/admin/format';
import { getPrisma } from '@/lib/db/prisma';
import { invoiceSettings } from '@/lib/invoices/service';
import { fromCents, toCents } from '@/lib/refunds/amounts';
import { turnover } from '@/lib/tax/admin';
import {
  checkStripeTaxAction,
  saveTaxSettingsAction,
} from '@/lib/tax/admin-actions';
import { franchiseStatus, projectYear } from '@/lib/tax/franchise';
import styles from '@/components/admin/Admin.module.scss';
import { requireAdmin } from '@/lib/admin/auth';

const monthName = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  timeZone: 'UTC',
});

export default async function TaxPage() {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const now = new Date();
  const year = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
    }).format(now),
  );
  const [settings, current, previous] = await Promise.all([
    invoiceSettings(getPrisma()),
    turnover(year),
    turnover(year - 1),
  ]);
  const baseCents = toCents(settings.franchiseThreshold);
  const majoredCents = toCents(settings.franchiseMajoredThreshold);
  const status = franchiseStatus({
    currentCents: current.totalCents,
    previousCents: previous.totalCents,
    baseCents,
    majoredCents,
  });
  const projection = projectYear(current.totalCents, now);
  const franchise = settings.vatRegime === 'FRANCHISE';
  const percent = (value: number, of: number) =>
    Math.min(100, Math.max(0, (value / of) * 100));
  return (
    <>
      <PageHeader
        title="Fiscalité"
        description="Chiffre d’affaires encaissé (paiements confirmés moins remboursements) face aux seuils de la franchise en base de TVA, et calcul de la TVA par Stripe Tax le jour où vous devenez assujetti."
      />
      {franchise && status.level !== 'OK' && (
        <IntegrityWarning>
          <strong>{status.title}.</strong> {status.message}
        </IntegrityWarning>
      )}
      <section className={styles.card}>
        <h2>
          {franchise ? status.title : 'Régime assujetti : la TVA est facturée'}
        </h2>
        <p>
          Chiffre d’affaires {year} :{' '}
          <strong>{euros(fromCents(current.totalCents))}</strong> · projection
          sur l’année : {euros(fromCents(projection))} · {year - 1} :{' '}
          {euros(fromCents(previous.totalCents))}
        </p>
        {franchise && (
          <>
            <label className={styles.full}>
              Seuil de base ({euros(settings.franchiseThreshold)}) :{' '}
              {percent(current.totalCents, baseCents)
                .toFixed(1)
                .replace('.', ',')}{' '}
              %
              <progress
                value={percent(current.totalCents, baseCents)}
                max={100}
              />
            </label>
            <label className={styles.full}>
              Seuil majoré ({euros(settings.franchiseMajoredThreshold)}) :{' '}
              {percent(current.totalCents, majoredCents)
                .toFixed(1)
                .replace('.', ',')}{' '}
              %
              <progress
                value={percent(current.totalCents, majoredCents)}
                max={100}
              />
            </label>
            <p className={styles.muted}>{status.message}</p>
          </>
        )}
        <p className={styles.muted}>
          Régime des factures :{' '}
          <strong>
            {franchise
              ? 'franchise en base (art. 293 B du CGI)'
              : 'assujetti à la TVA'}
          </strong>{' '}
          — à changer dans{' '}
          <Link href="/admin/factures/reglages">Mentions des factures</Link>.
          Ces chiffres aident au suivi ; la décision revient à votre
          expert-comptable.
        </p>
      </section>
      <section className={styles.card}>
        <h2>Mois par mois — {year}</h2>
        <AdminTable
          caption={`Chiffre d’affaires ${year}`}
          headings={[
            'Mois',
            'Commandes payées',
            'Ventes',
            'Remboursements',
            'Net',
          ]}
        >
          {current.months.map((row) => (
            <tr key={row.month}>
              <td>{monthName.format(new Date(`${row.month}-01T12:00:00Z`))}</td>
              <td>{row.orders}</td>
              <td>{euros(fromCents(row.salesCents))}</td>
              <td>
                {row.refundCents
                  ? `−${euros(fromCents(row.refundCents))}`
                  : '—'}
              </td>
              <td>
                <strong>{euros(fromCents(row.netCents))}</strong>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>
      <section className={styles.card} id="stripe-tax">
        <h2>Stripe Tax</h2>
        <p>
          État :{' '}
          <strong>{settings.stripeTaxEnabled ? 'activé' : 'désactivé'}</strong>
          {franchise &&
            ' — il reste désactivé tant que la société est en franchise : aucune TVA ne doit être facturée.'}
        </p>
        <p className={styles.muted}>
          Une fois activé (régime assujetti uniquement), la TVA de chaque
          commande est calculée par Stripe avant le paiement — les prix restent
          TTC —, figure ligne par ligne sur la facture, puis la vente et chaque
          remboursement sont enregistrés dans les déclarations Stripe Tax. Avant
          de l’activer : Stripe Tax configuré dans le Dashboard (adresse du
          siège, immatriculation TVA française), permission « Tax » ajoutée à la
          clé restreinte.
        </p>
        <AdminForm
          action={saveTaxSettingsAction}
          confirm="Enregistrer ces réglages fiscaux ? Ils s’appliquent aux prochaines commandes."
        >
          <div className={styles.fields}>
            <label className={styles.full}>
              <input
                type="checkbox"
                name="stripeTaxEnabled"
                defaultChecked={settings.stripeTaxEnabled}
                disabled={franchise && !settings.stripeTaxEnabled}
              />
              Calculer et déclarer la TVA avec Stripe Tax
            </label>
            <label>
              Code fiscal des articles
              <input
                name="productTaxCode"
                defaultValue={settings.productTaxCode}
                required
                maxLength={20}
              />
              <small>txcd_99999999 : biens corporels (général)</small>
            </label>
            <label>
              Code fiscal de la livraison
              <input
                name="shippingTaxCode"
                defaultValue={settings.shippingTaxCode}
                required
                maxLength={20}
              />
              <small>txcd_92010001 : frais de port</small>
            </label>
            <label>
              Seuil de base de la franchise (€)
              <input
                name="franchiseThreshold"
                inputMode="decimal"
                required
                defaultValue={settings.franchiseThreshold
                  .toFixed(2)
                  .replace('.', ',')}
              />
            </label>
            <label>
              Seuil majoré (€)
              <input
                name="franchiseMajoredThreshold"
                inputMode="decimal"
                required
                defaultValue={settings.franchiseMajoredThreshold
                  .toFixed(2)
                  .replace('.', ',')}
              />
            </label>
          </div>
        </AdminForm>
        <AdminForm action={checkStripeTaxAction} submit="Vérifier Stripe Tax">
          <p className={styles.muted}>
            Lecture seule : demande à Stripe si Stripe Tax est prêt sur le
            compte, sans rien modifier.
          </p>
        </AdminForm>
      </section>
    </>
  );
}
