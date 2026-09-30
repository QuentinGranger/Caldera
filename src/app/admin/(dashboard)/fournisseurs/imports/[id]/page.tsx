import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import {
  AdminTable,
  Badge,
  IntegrityWarning,
  PageHeader,
  Pagination,
} from '@/components/admin/AdminUI';
import { OcrProgress } from '@/components/admin/OcrProgress';
import { ImportRowsTable } from '@/components/admin/SupplierImportRows';
import {
  ImportBadge,
  ImportSteps,
  SummaryList,
} from '@/components/admin/SupplierImportParts';
import { requireAdmin } from '@/lib/admin/auth';
import { formatDate, label } from '@/lib/admin/format';
import { param, type SearchParams } from '@/lib/admin/queries';
import { uuid } from '@/lib/admin/validation';
import type { AppliedReport, RevertReport } from '@/lib/supplier-import/apply';
import {
  getImport,
  getImportRows,
  ROW_PAGE_SIZE,
} from '@/lib/supplier-import/admin';
import {
  aiPageAction,
  applyAction,
  bulkAction,
  cancelAction,
  mappingAction,
  pageAction,
  revertAction,
  sheetAction,
} from '@/lib/supplier-import/admin-actions';
import { FIELDS, type FieldKey } from '@/lib/supplier-import/fields';
import { PAGE_CONFIDENCE_THRESHOLD } from '@/lib/supplier-import/layout';
import type { Mapping } from '@/lib/supplier-import/normalize';
import type { RawRow } from '@/lib/supplier-import/records';
import type {
  Extraction,
  ImportOptions,
  StoredSummary,
} from '@/lib/supplier-import/service';
import styles from '@/components/admin/Admin.module.scss';
import local from '@/components/admin/SupplierImport.module.scss';

// Server Actions of this page read files, run OCR and analyse thousands of rows.
export const maxDuration = 60;

const GROUPS: { title: string; fields: FieldKey[] }[] = [
  {
    title: 'Identification',
    fields: [
      'supplierSku',
      'ean',
      'name',
      'brand',
      'game',
      'series',
      'category',
      'language',
      'condition',
    ],
  },
  {
    title: 'Prix',
    fields: ['purchasePrice', 'purchasePriceInclTax', 'msrp', 'vatRate'],
  },
  {
    title: 'Stock et disponibilité',
    fields: [
      'stock',
      'availability',
      'releaseDate',
      'restockDate',
      'minOrderQty',
      'packaging',
    ],
  },
  { title: 'Contenu', fields: ['description', 'imageUrl', 'productUrl'] },
];

const ROW_TABS = [
  ['review', 'À vérifier', 'REVIEW'],
  ['rejected', 'Rejetées', 'REJECT'],
  ['products', 'Nouveaux produits', 'CREATE_PRODUCT'],
  ['created', 'Nouvelles offres', 'CREATE_OFFER'],
  ['updated', 'Mises à jour', 'UPDATE_OFFER'],
  ['unchanged', 'Inchangées', 'UNCHANGED'],
  ['ignored', 'Ignorées', 'IGNORE'],
] as const;

const LANGUAGES = ['FR', 'EN', 'JP', 'DE', 'ES', 'IT', 'OTHER'];
const VAT_RATES = ['20.00', '10.00', '5.50', '2.10', '0.00'];

export default async function SupplierImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const { id } = await params;
  let importId: string;
  try {
    importId = uuid(id);
  } catch {
    notFound();
  }
  const data = await getImport(importId);
  if (!data) notFound();
  const { record } = data;
  const query = await searchParams;
  const headers = (record.headers as string[] | null) ?? [];
  const mapping = (record.mapping ?? {}) as Mapping;
  const options = (record.options ?? null) as ImportOptions | null;
  const extraction = (record.extraction ?? null) as Extraction | null;
  const summary = (record.summary ?? null) as
    | (StoredSummary & { applied?: AppliedReport; reverted?: RevertReport })
    | null;
  const editable = record.status === 'MAPPING' || record.status === 'REVIEW';
  const withRows = ['REVIEW', 'APPLIED', 'REVERTED'].includes(record.status);
  const filter =
    param(query, 'rows') ||
    (record.status === 'REVIEW' && data.actions.REVIEW ? 'review' : '');
  const rows = withRows
    ? await getImportRows(importId, { ...query, rows: filter })
    : null;
  const closed = ['APPLIED', 'REVERTED', 'CANCELED'].includes(record.status);
  const ocrPages = record.pages.filter((page) => page.method === 'OCR');
  const pending = record.pages.filter((page) => page.status === 'PENDING');
  const weakPages = record.pages.filter(
    (page) => page.status === 'NEEDS_REVIEW' || page.status === 'FAILED',
  );
  const column = (key: FieldKey) => headers.indexOf(mapping[key] ?? '');
  const sampleOf = (index: number) =>
    data.sample
      .map((row) => (row.raw as RawRow).cells[index] ?? '')
      .find((value) => value.trim()) ?? '';
  const path = `/admin/fournisseurs/imports/${record.id}`;
  const tabHref = (value: string) => {
    const next = new URLSearchParams();
    next.set('rows', value || 'all');
    return `${path}?${next}#lignes`;
  };
  return (
    <>
      <PageHeader
        title={record.fileName}
        description={`${record.supplier.name} · ${record.fileKind} · ${label(record.scope)} · déposé par ${record.createdBy.name} le ${formatDate(record.createdAt)}`}
      >
        <div className={styles.inline}>
          <ImportBadge status={record.status} />
          <Link href={`/admin/fournisseurs/${record.supplier.id}`}>
            {record.supplier.name}
          </Link>
          {!closed && (
            <AdminForm
              action={cancelAction}
              submit="Abandonner l’import"
              confirm="Abandonner cet import ? Le fichier et l’analyse sont supprimés ; rien n’a été importé."
            >
              <Hidden name="id" value={record.id} />
            </AdminForm>
          )}
        </div>
      </PageHeader>
      <ImportSteps status={record.status} />

      {record.status === 'FAILED' && (
        <section className={styles.card}>
          <IntegrityWarning>{record.error}</IntegrityWarning>
          <Link
            href={`/admin/fournisseurs/imports/nouveau?fournisseur=${record.supplier.id}`}
          >
            Déposer un autre fichier
          </Link>
        </section>
      )}
      {record.status === 'UPLOADING' && (
        <section className={styles.card}>
          <p>
            Envoi interrompu ({data.uploaded} partie(s) reçue(s)). Abandonnez
            cet import puis déposez à nouveau le fichier.
          </p>
        </section>
      )}
      {record.status === 'EXTRACTING' && (
        <section className={styles.card}>
          <h2>Lecture du PDF</h2>
          <OcrProgress
            importId={record.id}
            total={ocrPages.length}
            pending={pending.length}
          />
        </section>
      )}

      {record.fileKind === 'PDF' && editable && record.pages.length > 0 && (
        <section className={styles.card} id="pages">
          <h2>Pages du PDF · {record.pages.length}</h2>
          <p className={styles.muted}>
            Chaque page est lue localement (texte du PDF, ou OCR si c’est un
            scan) et reçoit un score de confiance. Sous{' '}
            {Math.round(PAGE_CONFIDENCE_THRESHOLD * 100)} %, vérifiez ses lignes
            : vous pouvez l’ignorer, ou la faire relire par l’IA — seule cette
            page est alors envoyée à l’API Claude d’Anthropic.
          </p>
          {weakPages.length > 0 && (
            <IntegrityWarning>
              {weakPages.length} page(s) à vérifier :{' '}
              {weakPages.map((page) => page.page).join(', ')}.
            </IntegrityWarning>
          )}
          {!data.aiAvailable && weakPages.length > 0 && (
            <p className={styles.muted}>
              La relecture par IA n’est pas configurée (variable
              ANTHROPIC_API_KEY absente du serveur).
            </p>
          )}
          <AdminTable
            caption="Pages du PDF"
            headings={[
              'Page',
              'Lecture',
              'Confiance',
              'Lignes',
              'État',
              'Actions',
            ]}
          >
            {record.pages.map((page) => (
              <tr key={page.page}>
                <td>{page.page}</td>
                <td>{label(`METHOD_${page.method}`)}</td>
                <td>
                  {page.confidence === null
                    ? '—'
                    : `${Math.round(page.confidence * 100)} %`}
                </td>
                <td>{data.rowsByPage.get(page.page) ?? 0}</td>
                <td>
                  <Badge
                    value={`PAGE_${page.status}`}
                    tone={
                      page.status === 'DONE'
                        ? 'success'
                        : page.status === 'NEEDS_REVIEW'
                          ? 'pending'
                          : page.status === 'FAILED'
                            ? 'danger'
                            : 'neutral'
                    }
                  />
                  {page.note && <small>{page.note}</small>}
                </td>
                <td>
                  <div className={styles.inline}>
                    {page.status === 'IGNORED' ? (
                      <AdminForm action={pageAction} submit="Réintégrer">
                        <Hidden name="id" value={record.id} />
                        <Hidden name="page" value={page.page} />
                        <Hidden name="change" value="restore" />
                      </AdminForm>
                    ) : (
                      <AdminForm action={pageAction} submit="Ignorer">
                        <Hidden name="id" value={record.id} />
                        <Hidden name="page" value={page.page} />
                        <Hidden name="change" value="ignore" />
                      </AdminForm>
                    )}
                    {page.method === 'AI' ? (
                      <AdminForm action={pageAction} submit="Lecture locale">
                        <Hidden name="id" value={record.id} />
                        <Hidden name="page" value={page.page} />
                        <Hidden name="change" value="local" />
                      </AdminForm>
                    ) : (
                      data.aiAvailable &&
                      page.status !== 'IGNORED' && (
                        <AdminForm
                          action={aiPageAction}
                          submit="Relire par IA"
                          confirm={`Envoyer la page ${page.page} (et elle seule) à l’API Claude d’Anthropic pour en extraire le tableau ? Le résultat reste à vérifier dans l’aperçu.`}
                        >
                          <Hidden name="id" value={record.id} />
                          <Hidden name="page" value={page.page} />
                        </AdminForm>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        </section>
      )}

      {editable && (extraction?.sheets?.length ?? 0) > 1 && (
        <section className={styles.card}>
          <h2>Feuille du classeur</h2>
          <AdminForm action={sheetAction} submit="Lire cette feuille">
            <Hidden name="id" value={record.id} />
            <label>
              Feuille lue
              <select name="sheet" defaultValue={extraction?.sheet}>
                {extraction!.sheets!.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name} — {sheet.rows} ligne(s) de produits
                  </option>
                ))}
              </select>
            </label>
          </AdminForm>
        </section>
      )}

      {editable && headers.length > 0 && (
        <section className={styles.card} id="extraction">
          <h2>Tableau lu · {extraction?.rows ?? 0} lignes</h2>
          <p className={styles.muted}>
            {[
              extraction?.encoding && `Encodage ${extraction.encoding}`,
              extraction?.delimiter &&
                `séparateur « ${extraction.delimiter === '\t' ? 'tabulation' : extraction.delimiter} »`,
              extraction?.sheet && `feuille « ${extraction.sheet} »`,
              extraction?.jsonPath && `liste « ${extraction.jsonPath} »`,
              extraction?.pageCount && `${extraction.pageCount} page(s)`,
              `${extraction?.skipped ?? 0} ligne(s) écartée(s) (titres, vides, en-têtes répétés)`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <AdminTable
            caption="Premières lignes lues"
            headings={['Ligne', ...headers]}
          >
            {data.sample.map((row) => (
              <tr key={row.rowNumber}>
                <td>
                  {row.rowNumber > 1000 ? row.rowNumber % 1000 : row.rowNumber}
                  {row.source && <small>{row.source}</small>}
                </td>
                {headers.map((header, index) => (
                  <td key={header} className={local.raw}>
                    {(row.raw as RawRow).cells[index]}
                  </td>
                ))}
              </tr>
            ))}
          </AdminTable>
        </section>
      )}

      {editable && headers.length > 0 && (
        <section className={styles.card} id="colonnes">
          <h2>Colonnes</h2>
          {record.profile && (
            <p>
              Colonnes du profil « {record.profile.name} » de ce fournisseur,
              retrouvé grâce aux titres des colonnes. Vérifiez-les avant
              l’analyse.
            </p>
          )}
          {data.otherProfiles.length > 0 && (
            <IntegrityWarning>
              Ces colonnes correspondent au format enregistré de{' '}
              {data.otherProfiles
                .map((profile) => `« ${profile.supplier.name} »`)
                .join(', ')}{' '}
              : vérifiez que le fournisseur choisi est le bon.
            </IntegrityWarning>
          )}
          <AdminForm
            action={mappingAction}
            submit={
              record.status === 'REVIEW'
                ? 'Relancer l’analyse'
                : 'Analyser le fichier'
            }
            confirm={
              record.status === 'REVIEW'
                ? 'Relancer l’analyse ? Les décisions et corrections déjà faites sur les lignes seront perdues.'
                : undefined
            }
          >
            <Hidden name="id" value={record.id} />
            {GROUPS.map((group) => (
              <div key={group.title}>
                <p className={local.group}>{group.title}</p>
                <div className={local.mapping}>
                  {group.fields.map((key) => {
                    const field = FIELDS.find((item) => item.key === key)!;
                    const index = column(key);
                    const required = key === 'name';
                    const either = key === 'supplierSku' || key === 'ean';
                    return (
                      <label key={key}>
                        <span>
                          {field.label}
                          {required && (
                            <span className={local.required}> *</span>
                          )}
                          {either && <span className={local.required}> †</span>}
                        </span>
                        <select
                          name={`field:${key}`}
                          defaultValue={mapping[key] ?? ''}
                        >
                          <option value="">— absent du fichier —</option>
                          {headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                        <small>
                          {index >= 0
                            ? `ex. ${sampleOf(index) || '(vide)'}`
                            : ' '}
                        </small>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className={styles.muted}>
              * obligatoire · † référence fournisseur ou EAN, au moins l’une des
              deux.
            </p>
            <p className={local.group}>Lecture des valeurs</p>
            <div className={styles.fields}>
              <label>
                Séparateur décimal des prix
                <select name="decimal" defaultValue={options?.decimal ?? ','}>
                  <option value=",">Virgule (12,50)</option>
                  <option value=".">Point (12.50)</option>
                </select>
              </label>
              <label>
                Ordre des dates
                <select
                  name="dateOrder"
                  defaultValue={options?.dateOrder ?? 'DMY'}
                >
                  <option value="DMY">Jour/mois/année (31/12/2026)</option>
                  <option value="MDY">Mois/jour/année (12/31/2026)</option>
                </select>
              </label>
              <label>
                Langue si le fichier ne la donne pas
                <select
                  name="defaultLanguage"
                  defaultValue={options?.defaultLanguage ?? ''}
                >
                  <option value="">Aucune (à déduire du nom)</option>
                  {LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {label(language)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                TVA pour calculer le HT depuis un prix TTC
                <select
                  name="defaultVatRate"
                  defaultValue={options?.defaultVatRate ?? ''}
                >
                  <option value="">Aucune</option>
                  {VAT_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {Number(rate).toLocaleString('fr-FR')} %
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ce fichier est
                <select name="scope" defaultValue={record.scope}>
                  <option value="FULL">
                    Le catalogue complet (absents signalés)
                  </option>
                  <option value="PARTIAL">Un extrait (absents ignorés)</option>
                </select>
              </label>
            </div>
            {options && options.dateOrderCertain === false && (
              <IntegrityWarning>
                Aucune date du fichier ne permet de distinguer jour et mois :
                confirmez l’ordre des dates.
              </IntegrityWarning>
            )}
            <div className={styles.fields}>
              <label>
                <input type="checkbox" name="saveProfile" defaultChecked />
                Retenir ces colonnes pour les prochains fichiers de ce format
              </label>
              <label>
                Nom du profil
                <input
                  name="profileName"
                  maxLength={120}
                  defaultValue={
                    record.profile?.name ??
                    `${record.supplier.name} — ${record.fileKind}`
                  }
                />
              </label>
            </div>
          </AdminForm>
        </section>
      )}

      {record.status === 'REVIEW' && summary && (
        <section className={styles.card} id="apercu">
          <h2>Aperçu avant import</h2>
          <p className={styles.muted}>
            Normalisation, correspondances et comparaison avec le dernier
            catalogue de {record.supplier.name}. Les produits de la boutique ne
            sont jamais modifiés : seules les offres du fournisseur le sont, et
            les nouveautés deviennent des brouillons non publiés.
          </p>
          <SummaryList summary={summary} scope={record.scope} />
          <div className={styles.inline}>
            {(data.actions.REVIEW ?? 0) > 0 && (
              <AdminForm
                action={bulkAction}
                submit="Confirmer les correspondances probables"
                confirm="Lier chaque ligne « probable » au produit proposé, quand rien d’autre n’est douteux sur la ligne ?"
              >
                <Hidden name="id" value={record.id} />
                <Hidden name="kind" value="confirm-probable" />
              </AdminForm>
            )}
            {(data.actions.CREATE_PRODUCT ?? 0) > 0 && (
              <AdminForm
                action={bulkAction}
                submit="Nouveautés en offres seules"
                confirm="Ne créer aucun brouillon : les nouvelles références sont enregistrées comme offres, sans produit Caldera ?"
              >
                <Hidden name="id" value={record.id} />
                <Hidden name="kind" value="offers-only" />
              </AdminForm>
            )}
            {(data.actions.REVIEW ?? 0) > 0 && (
              <AdminForm
                action={bulkAction}
                submit="Ignorer les lignes à vérifier"
                confirm="Ignorer toutes les lignes encore à vérifier ? Elles ne seront pas importées."
              >
                <Hidden name="id" value={record.id} />
                <Hidden name="kind" value="ignore-review" />
              </AdminForm>
            )}
          </div>
        </section>
      )}

      {record.status === 'APPLIED' && summary?.applied && (
        <section className={styles.card} id="rapport">
          <h2>Rapport d’import</h2>
          <p>
            Validé par {record.appliedBy?.name} le{' '}
            {formatDate(record.appliedAt)} · traitement{' '}
            {((record.durationMs ?? 0) / 1000).toFixed(1).replace('.', ',')} s
          </p>
          <dl className={local.summary}>
            {(
              [
                ['Offres créées', summary.applied.offersCreated],
                ['Offres mises à jour', summary.applied.offersUpdated],
                ['Inchangées', summary.applied.offersUnchanged],
                ['Brouillons créés', summary.applied.productsCreated],
                ['Disparues du catalogue', summary.applied.offersMissing],
                ['Lignes ignorées', summary.applied.ignored],
                ['Lignes rejetées', summary.applied.rejected],
              ] as const
            ).map(([title, value]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {data.revertible && (
            <AdminForm
              action={revertAction}
              submit="Défaire cet import"
              confirm="Défaire cet import ? Les offres reprennent leurs valeurs d’avant, les offres créées sont supprimées, ainsi que les brouillons auxquels personne n’a touché."
            >
              <Hidden name="id" value={record.id} />
            </AdminForm>
          )}
        </section>
      )}
      {record.status === 'REVERTED' && summary?.reverted && (
        <section className={styles.card}>
          <h2>Import défait le {formatDate(record.revertedAt)}</h2>
          <p>
            {summary.reverted.offersRestored} offre(s) restaurée(s) ·{' '}
            {summary.reverted.offersDeleted} offre(s) supprimée(s) ·{' '}
            {summary.reverted.offersBackFromMissing} de nouveau au catalogue ·{' '}
            {summary.reverted.productsDeleted} brouillon(s) supprimé(s)
            {summary.reverted.productsKept
              ? ` · ${summary.reverted.productsKept} brouillon(s) conservé(s) car déjà retravaillé(s)`
              : ''}
          </p>
        </section>
      )}
      {data.drafts.length > 0 && (
        <section className={styles.card}>
          <h2>Brouillons créés · {data.drafts.length}</h2>
          <p className={styles.muted}>
            Non publiés, dans la catégorie cachée « À classer ». Avant
            publication : image, titre définitif, description, vraie catégorie
            et prix de vente.
          </p>
          <ul className={styles.plainList}>
            {data.drafts.map((product) => (
              <li key={product.id}>
                <Link href={`/admin/produits/${product.id}`}>
                  {product.name}
                </Link>{' '}
                <Badge value={product.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows && (
        <section className={styles.card} id="lignes">
          <h2>Lignes</h2>
          <nav className={styles.tabs} aria-label="Lignes par action">
            {ROW_TABS.map(([value, title, action]) => (
              <Link
                key={value}
                href={tabHref(value)}
                aria-current={filter === value ? 'page' : undefined}
              >
                {title} · {data.actions[action] ?? 0}
              </Link>
            ))}
            <Link
              href={tabHref('')}
              aria-current={
                !ROW_TABS.some(([value]) => value === filter)
                  ? 'page'
                  : undefined
              }
            >
              Toutes
            </Link>
          </nav>
          <form action={path} className={styles.inline}>
            <input type="hidden" name="rows" value={filter || 'all'} />
            <label>
              <span className={styles.visuallyHidden}>
                Rechercher une ligne
              </span>
              <input
                type="search"
                name="search"
                defaultValue={param(query, 'search')}
                placeholder="Nom, référence ou EAN"
              />
            </label>
            <button type="submit">Rechercher</button>
          </form>
          <ImportRowsTable
            importId={record.id}
            data={rows}
            editable={record.status === 'REVIEW'}
          />
          {rows.total > ROW_PAGE_SIZE && (
            <Pagination
              page={rows.page}
              total={rows.total}
              params={{ ...query, rows: filter || 'all' }}
              path={path}
            />
          )}
        </section>
      )}

      {record.status === 'REVIEW' && summary && (
        <section className={styles.card} id="validation">
          <h2>Validation</h2>
          <p>
            Tout est appliqué en une seule fois, ou rien. Le rapport et
            l’historique des changements sont conservés ; l’import pourra être
            défait tant qu’aucun import plus récent de ce fournisseur n’est
            appliqué.
          </p>
          <AdminForm
            action={applyAction}
            submit="Valider et importer"
            confirm={`Importer maintenant ? ${summary.offersCreated} offre(s) créée(s), ${summary.offersUpdated} mise(s) à jour, ${summary.newProducts} brouillon(s) créé(s)${record.scope === 'FULL' ? `, ${summary.disappeared} offre(s) signalée(s) disparue(s)` : ''}.`}
          >
            <Hidden name="id" value={record.id} />
            {summary.toReview > 0 && (
              <label>
                <input type="checkbox" name="ignoreReview" />
                Ignorer les {summary.toReview} ligne(s) encore à vérifier
              </label>
            )}
          </AdminForm>
        </section>
      )}
    </>
  );
}
