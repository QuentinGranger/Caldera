import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import { Badge } from '@/components/admin/AdminUI';
import { euros, label } from '@/lib/admin/format';
import type { AdminAction } from '@/lib/admin/action-types';
import type { Change } from '@/lib/supplier-import/analysis';
import { FIELD_BY_KEY, type FieldKey } from '@/lib/supplier-import/fields';
import type { Issue } from '@/lib/supplier-import/normalize';
import type { StoredSummary } from '@/lib/supplier-import/service';
import styles from './Admin.module.scss';
import local from './SupplierImport.module.scss';

type Tone = 'danger' | 'success' | 'pending' | 'info' | 'neutral';

export function ImportBadge({ status }: { status: string }) {
  const tone: Tone =
    status === 'APPLIED'
      ? 'success'
      : status === 'FAILED'
        ? 'danger'
        : status === 'MAPPING' || status === 'REVIEW'
          ? 'pending'
          : status === 'UPLOADING' || status === 'EXTRACTING'
            ? 'info'
            : 'neutral';
  return <Badge value={`IMPORT_${status}`} tone={tone} />;
}

export function RowBadge({ action }: { action: string | null }) {
  if (!action) return null;
  const tone: Tone =
    action === 'REJECT'
      ? 'danger'
      : action === 'REVIEW'
        ? 'pending'
        : action === 'CREATE_PRODUCT'
          ? 'info'
          : action === 'CREATE_OFFER' || action === 'UPDATE_OFFER'
            ? 'success'
            : 'neutral';
  return <Badge value={`ROW_${action}`} tone={tone} />;
}

export function ChangeBadge({ kind }: { kind: string }) {
  const tone: Tone = ['PRICE_DOWN', 'BACK_IN_STOCK', 'REAPPEARED'].includes(
    kind,
  )
    ? 'success'
    : ['PRICE_UP', 'OUT_OF_STOCK', 'DISAPPEARED'].includes(kind)
      ? 'danger'
      : kind === 'NEW_OFFER'
        ? 'info'
        : 'neutral';
  return <Badge value={`CHANGE_${kind}`} tone={tone} />;
}

const STEPS = [
  'Fournisseur',
  'Fichier',
  'Extraction',
  'Colonnes',
  'Normalisation',
  'Correspondances',
  'Aperçu',
  'Import',
];

/** Where the import stands among the eight steps of the wizard. */
export function ImportSteps({ status }: { status: string }) {
  const current =
    {
      UPLOADING: 1,
      EXTRACTING: 2,
      MAPPING: 3,
      REVIEW: 6,
      APPLIED: 8,
      REVERTED: 8,
    }[status] ?? -1;
  return (
    <ol className={local.steps} aria-label="Étapes de l’import">
      {STEPS.map((step, index) => (
        <li
          key={step}
          className={index < current ? local.done : undefined}
          aria-current={index === current ? 'step' : undefined}
        >
          {step}
        </li>
      ))}
    </ol>
  );
}

const PRICE_FIELDS = new Set(['purchasePrice', 'purchasePriceInclTax', 'msrp']);

function shown(field: string | null, value: string | number | null) {
  if (value === null || value === '') return '—';
  if (field && PRICE_FIELDS.has(field)) return euros(Number(value));
  if (field === 'availability') return label(`AVAIL_${value}`);
  if (field === 'vatRate') return `${String(value).replace('.', ',')} %`;
  if (field && /Date$/.test(field) && typeof value === 'string')
    return value.split('-').reverse().join('/');
  return String(value);
}

const fieldName = (field: string | null) =>
  field && field in FIELD_BY_KEY
    ? FIELD_BY_KEY[field as FieldKey].label
    : field;

export function ChangeList({ changes }: { changes: Change[] | null }) {
  if (!changes?.length) return null;
  return (
    <ul className={local.changes}>
      {changes.map((change, index) => (
        <li key={index}>
          <ChangeBadge kind={change.kind} />{' '}
          {change.kind !== 'NEW_OFFER' && change.field && (
            <>
              {change.kind === 'INFO' ? `${fieldName(change.field)} : ` : ''}
              {shown(change.field, change.before)} →{' '}
              {shown(change.field, change.after)}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function IssueList({ issues }: { issues: Issue[] | null }) {
  if (!issues?.length) return null;
  return (
    <ul className={local.issues}>
      {issues.map((issue, index) => (
        <li
          key={index}
          className={
            issue.level === 'error'
              ? local.issueError
              : issue.level === 'review'
                ? local.issueReview
                : local.issueInfo
          }
        >
          <strong>
            {issue.field === 'row' ? 'Ligne' : fieldName(issue.field)}
          </strong>
          {issue.value ? (
            <>
              {' '}
              « <code>{issue.value.slice(0, 60)}</code> »
            </>
          ) : null}{' '}
          : {issue.problem}
          {issue.suggestion ? ` — ${issue.suggestion}` : ''}
        </li>
      ))}
    </ul>
  );
}

/** The preview counts, as asked: what the import would do, before it does. */
export function SummaryList({
  summary,
  scope,
}: {
  summary: StoredSummary;
  scope: string;
}) {
  const items: [string, number, boolean?][] = [
    ['Lignes lues', summary.rows],
    ['Produits reconnus', summary.existing],
    ['Nouveaux produits (brouillons)', summary.newProducts],
    ['Offres créées', summary.offersCreated],
    ['Offres mises à jour', summary.offersUpdated],
    ['Inchangées', summary.unchanged],
    ['Prix en baisse', summary.priceDown],
    ['Prix en hausse', summary.priceUp],
    ['De retour en stock', summary.backInStock],
    ['Plus en stock', summary.outOfStock],
    ['Indisponibles', summary.unavailable],
    ...(scope === 'FULL'
      ? ([['Disparues du catalogue', summary.disappeared]] as [
          string,
          number,
        ][])
      : []),
    ['À vérifier', summary.toReview, true],
    ['Doublons', summary.duplicates, true],
    ['Lignes en erreur', summary.errors, true],
    ['Rejetées', summary.rejected, true],
    ['Ignorées', summary.ignored],
  ];
  return (
    <dl className={local.summary}>
      {items.map(([title, value, alert]) => (
        <div key={title} className={alert && value ? local.alert : undefined}>
          <dt>{title}</dt>
          <dd>{value ?? 0}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SupplierForm({
  action,
  supplier,
}: {
  action: AdminAction;
  supplier?: {
    id: string;
    name: string;
    code: string;
    email: string | null;
    website: string | null;
    notes: string | null;
    isActive: boolean;
  };
}) {
  return (
    <AdminForm
      action={action}
      submit={supplier ? 'Enregistrer' : 'Ajouter le fournisseur'}
      confirm="Désactiver ce fournisseur ? Ses offres restent, mais aucun nouvel import ne sera possible."
      confirmWhen="inactive"
    >
      {supplier && <Hidden name="id" value={supplier.id} />}
      <div className={styles.fields}>
        <label>
          Nom
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={supplier?.name}
          />
        </label>
        <label>
          Code (2 à 12 lettres ou chiffres, dans le SKU des brouillons)
          <input
            name="code"
            required
            maxLength={12}
            pattern="[A-Za-z0-9]{2,12}"
            defaultValue={supplier?.code}
            placeholder="ex. ASMODEE"
          />
        </label>
        <label>
          E-mail — facultatif
          <input
            name="email"
            type="email"
            maxLength={200}
            defaultValue={supplier?.email ?? ''}
          />
        </label>
        <label>
          Site — facultatif
          <input
            name="website"
            type="url"
            maxLength={300}
            defaultValue={supplier?.website ?? ''}
            placeholder="https://"
          />
        </label>
        <label className={styles.full}>
          Notes internes — facultatives (conditions, franco, contact)
          <textarea
            name="notes"
            maxLength={2000}
            defaultValue={supplier?.notes ?? ''}
          />
        </label>
        {supplier && (
          <label>
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={supplier.isActive}
            />
            Fournisseur actif
          </label>
        )}
      </div>
    </AdminForm>
  );
}
