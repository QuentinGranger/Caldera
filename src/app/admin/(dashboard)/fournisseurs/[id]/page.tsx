import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Upload } from 'lucide-react';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import { FilterPanel } from '@/components/admin/FilterPanel';
import {
  AdminTable,
  Badge,
  EmptyState,
  FilterSelect,
  PageHeader,
  Pagination,
} from '@/components/admin/AdminUI';
import { SupplierForm } from '@/components/admin/SupplierImportParts';
import { ImportsTable } from '@/components/admin/SupplierTables';
import { requireAdmin } from '@/lib/admin/auth';
import { euros, formatDate, label } from '@/lib/admin/format';
import { param, type SearchParams } from '@/lib/admin/queries';
import { uuid } from '@/lib/admin/validation';
import { getSupplier, getSupplierImports } from '@/lib/supplier-import/admin';
import {
  deleteProfileAction,
  saveSupplierAction,
} from '@/lib/supplier-import/admin-actions';
import styles from '@/components/admin/Admin.module.scss';

export default async function SupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const { id } = await params;
  let supplierId: string;
  try {
    supplierId = uuid(id);
  } catch {
    notFound();
  }
  const query = await searchParams;
  const [data, imports] = await Promise.all([
    getSupplier(supplierId, query),
    getSupplierImports({ supplier: supplierId }, 10),
  ]);
  if (!data) notFound();
  const { supplier } = data;
  const path = `/admin/fournisseurs/${supplier.id}`;
  return (
    <>
      <PageHeader
        title={supplier.name}
        description={`Code ${supplier.code}${supplier.isActive ? '' : ' · désactivé'} · ajouté le ${formatDate(supplier.createdAt)}`}
      >
        {supplier.isActive && (
          <Link
            className={styles.button}
            href={`/admin/fournisseurs/imports/nouveau?fournisseur=${supplier.id}`}
          >
            <Upload size={17} aria-hidden="true" />
            Importer un catalogue
          </Link>
        )}
      </PageHeader>
      <section className={styles.card} id="offres">
        <h2>Offres · {data.total}</h2>
        <FilterPanel
          action={path}
          search={param(query, 'search')}
          placeholder="Nom, référence ou EAN"
          activeCount={
            [param(query, 'status'), param(query, 'link')].filter(Boolean)
              .length
          }
        >
          <FilterSelect
            name="status"
            label="Catalogue"
            value={param(query, 'status')}
            options={[
              { value: 'ACTIVE', label: label('OFFER_ACTIVE') },
              { value: 'MISSING', label: label('OFFER_MISSING') },
            ]}
          />
          <FilterSelect
            name="link"
            label="Produit Caldera"
            value={param(query, 'link')}
            options={[
              { value: 'linked', label: 'Lié à un produit' },
              { value: 'unlinked', label: 'Offre seule' },
            ]}
          />
        </FilterPanel>
        {data.offers.length ? (
          <>
            <AdminTable
              caption="Offres du fournisseur"
              headings={[
                'Référence',
                'Prix d’achat HT',
                'PVC',
                'Stock',
                'Produit Caldera',
                'Vue le',
              ]}
            >
              {data.offers.map((offer) => (
                <tr key={offer.id}>
                  <td>
                    {offer.name}
                    <small>
                      <code>{offer.supplierSku}</code>
                      {offer.ean ? ` · EAN ${offer.ean}` : ''}
                      {offer.language ? ` · ${label(offer.language)}` : ''}
                    </small>
                  </td>
                  <td>{euros(offer.purchasePrice)}</td>
                  <td>{euros(offer.msrp)}</td>
                  <td>
                    {offer.stock ?? '—'}
                    <small>{label(`AVAIL_${offer.availability}`)}</small>
                  </td>
                  <td>
                    {offer.variant ? (
                      <>
                        <Link
                          href={`/admin/produits/${offer.variant.product.id}`}
                        >
                          {offer.variant.product.name}
                        </Link>
                        <small>
                          {offer.variant.sku} · vendu{' '}
                          {euros(offer.variant.price)} ·{' '}
                          {label(offer.variant.product.status)}
                        </small>
                      </>
                    ) : (
                      'Offre seule'
                    )}
                  </td>
                  <td>
                    {formatDate(offer.lastSeenAt)}
                    {offer.status === 'MISSING' && (
                      <small>
                        <Badge value="OFFER_MISSING" tone="danger" />
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </AdminTable>
            <Pagination
              page={data.page}
              total={data.total}
              params={query}
              path={path}
            />
          </>
        ) : (
          <EmptyState>
            Aucune offre : importez un catalogue de ce fournisseur.
          </EmptyState>
        )}
      </section>
      <section className={styles.card}>
        <h2>Imports</h2>
        <ImportsTable rows={imports.rows} />
      </section>
      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Formats de fichier reconnus</h2>
          <p className={styles.muted}>
            Une correspondance validée est enregistrée pour ce fournisseur : un
            fichier aux mêmes colonnes la retrouve automatiquement (toujours
            modifiable avant l’analyse).
          </p>
          {supplier.profiles.length ? (
            <ul className={styles.plainList}>
              {supplier.profiles.map((profile) => (
                <li key={profile.id}>
                  <strong>{profile.name}</strong> · {profile.fileKind} ·{' '}
                  {Object.keys(profile.mapping as object).length} colonnes ·
                  utilisé {profile.useCount} fois
                  {profile.lastUsedAt
                    ? `, dernière fois le ${formatDate(profile.lastUsedAt)}`
                    : ''}
                  <AdminForm
                    action={deleteProfileAction}
                    submit="Supprimer"
                    confirm="Supprimer ce profil ? Le prochain fichier de ce format devra être associé à nouveau."
                  >
                    <Hidden name="id" value={profile.id} />
                  </AdminForm>
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucun profil pour l’instant.</p>
          )}
        </section>
        <section className={styles.card}>
          <h2>Informations</h2>
          <SupplierForm action={saveSupplierAction} supplier={supplier} />
        </section>
      </div>
    </>
  );
}
