import Link from 'next/link';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import { AdminTable, Badge, EmptyState } from '@/components/admin/AdminUI';
import { euros, label } from '@/lib/admin/format';
import type { getImportRows } from '@/lib/supplier-import/admin';
import {
  correctionAction,
  decisionAction,
} from '@/lib/supplier-import/admin-actions';
import type { Change } from '@/lib/supplier-import/analysis';
import { FIELD_BY_KEY, type FieldKey } from '@/lib/supplier-import/fields';
import type { Candidate } from '@/lib/supplier-import/matching';
import type { Issue, NormalizedValues } from '@/lib/supplier-import/normalize';
import type { RawRow } from '@/lib/supplier-import/records';
import { ChangeList, IssueList, RowBadge } from './SupplierImportParts';
import local from './SupplierImport.module.scss';

type Rows = Awaited<ReturnType<typeof getImportRows>>;

const MATCH_TONES = {
  CERTAIN: 'success',
  PROBABLE: 'pending',
  NEW: 'info',
  AMBIGUOUS: 'pending',
  INVALID: 'danger',
} as const;

/** Fields offered for correction: the doubtful ones, and the essentials. */
function correctable(issues: Issue[], values: NormalizedValues | null) {
  const fields = new Set<FieldKey>();
  for (const issue of issues)
    if (issue.level !== 'info' && issue.field !== 'row')
      fields.add(issue.field);
  if (!values?.name) fields.add('name');
  if (!values?.supplierSku) fields.add('supplierSku');
  return [...fields];
}

function Decision({
  importId,
  row,
  variants,
}: {
  importId: string;
  row: Rows['rows'][number];
  variants: Rows['variants'];
}) {
  const candidates = (row.candidates as Candidate[] | null) ?? [];
  const rejected = row.action === 'REJECT';
  const linked =
    row.variant && !candidates.some((c) => c.variantId === row.variantId);
  const issues = (row.issues as Issue[] | null) ?? [];
  const values = row.values as NormalizedValues | null;
  const raw = row.raw as RawRow;
  const fields = correctable(issues, values);
  return (
    <div className={local.decision}>
      <AdminForm action={decisionAction} submit="Décider">
        <Hidden name="id" value={importId} />
        <Hidden name="row" value={row.id} />
        <label>
          Décision
          <select
            name="decision"
            defaultValue={rejected ? 'ignore' : ''}
            required
          >
            <option value="" disabled>
              Choisir…
            </option>
            {!rejected && (
              <>
                {linked && row.variant && (
                  <option value={`link:${row.variantId}`}>
                    Confirmer : {row.variant.product.name} ({row.variant.sku})
                  </option>
                )}
                {candidates.map((candidate) => {
                  const variant = variants.get(candidate.variantId);
                  return variant ? (
                    <option
                      key={candidate.variantId}
                      value={`link:${candidate.variantId}`}
                    >
                      Lier à {variant.product.name} ({variant.sku},{' '}
                      {label(variant.language)}) — {candidate.reason}
                    </option>
                  ) : null;
                })}
                <option value="sku">Lier à un autre SKU Caldera…</option>
                <option value="create">Créer un produit brouillon</option>
                <option value="offer">Offre seule, sans produit</option>
              </>
            )}
            <option value="ignore">Ignorer cette ligne</option>
          </select>
        </label>
        {!rejected && (
          <label>
            SKU Caldera (si « autre SKU »)
            <input name="sku" maxLength={64} placeholder="ex. POK-ETB-FR" />
          </label>
        )}
      </AdminForm>
      {fields.length > 0 && (
        <details>
          <summary>Corriger une valeur</summary>
          <AdminForm action={correctionAction} submit="Corriger et réanalyser">
            <Hidden name="id" value={importId} />
            <Hidden name="row" value={row.id} />
            {fields.map((field) => (
              <label key={field}>
                {FIELD_BY_KEY[field].label}
                <input
                  name={`fix:${field}`}
                  maxLength={500}
                  defaultValue={
                    raw.corrections?.[field] ??
                    issues.find((issue) => issue.field === field)?.value ??
                    ''
                  }
                />
              </label>
            ))}
          </AdminForm>
        </details>
      )}
    </div>
  );
}

/** Line by line: what was read, what it matches, what it would do. */
export function ImportRowsTable({
  importId,
  data,
  editable,
}: {
  importId: string;
  data: Rows;
  editable: boolean;
}) {
  if (!data.rows.length)
    return <EmptyState>Aucune ligne dans cette vue.</EmptyState>;
  return (
    <AdminTable
      caption="Lignes du fichier"
      headings={[
        'Ligne',
        'Produit fournisseur',
        'Prix · stock',
        'Produit Caldera',
        'Action',
        'Changements et problèmes',
        ...(editable ? ['Décision'] : []),
      ]}
    >
      {data.rows.map((row) => {
        const values = row.values as NormalizedValues | null;
        const issues = (row.issues as Issue[] | null) ?? [];
        return (
          <tr key={row.id}>
            <td>
              {row.rowNumber > 1000 ? row.rowNumber % 1000 : row.rowNumber}
              {row.source && <small>{row.source}</small>}
            </td>
            <td className={local.tableCell}>
              {values?.name ?? <em>sans nom</em>}
              <small>
                {values?.supplierSku && <code>{values.supplierSku}</code>}
                {values?.ean ? ` · EAN ${values.ean}` : ''}
                {values?.language ? ` · ${label(values.language)}` : ''}
              </small>
            </td>
            <td>
              {values?.purchasePrice
                ? euros(Number(values.purchasePrice))
                : '—'}
              <small>
                {values?.msrp ? `PVC ${euros(Number(values.msrp))} · ` : ''}
                {values?.stock ?? '—'} ·{' '}
                {label(`AVAIL_${values?.availability ?? 'UNKNOWN'}`)}
              </small>
            </td>
            <td>
              {row.match && (
                <Badge
                  value={`MATCH_${row.match}`}
                  tone={MATCH_TONES[row.match]}
                />
              )}
              {row.variant && (
                <small>
                  <Link href={`/admin/produits/${row.variant.product.id}`}>
                    {row.variant.product.name}
                  </Link>{' '}
                  · {row.variant.sku}
                </small>
              )}
            </td>
            <td>
              <RowBadge action={row.action} />
              {row.decidedAt && <small>décidé à la main</small>}
              {row.appliedAt && <small>appliqué</small>}
            </td>
            <td className={local.tableCell}>
              <ChangeList changes={row.changes as Change[] | null} />
              <IssueList issues={issues} />
            </td>
            {editable && (
              <td>
                <Decision
                  importId={importId}
                  row={row}
                  variants={data.variants}
                />
              </td>
            )}
          </tr>
        );
      })}
    </AdminTable>
  );
}
