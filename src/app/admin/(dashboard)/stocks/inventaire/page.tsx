import Link from 'next/link';
import { AdminForm } from '@/components/admin/AdminForm';
import { Field, Hidden } from '@/components/admin/AdminFields';
import {
  AdminTable,
  EmptyState,
  PageHeader,
  Pagination,
} from '@/components/admin/AdminUI';
import { formatDate } from '@/lib/admin/format';
import { requireAdmin } from '@/lib/admin/auth';
import {
  pageNumber,
  pageSize,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import {
  approvePhysicalCountAction,
  recordPhysicalCountAction,
  saveInventoryProfileAction,
} from '@/lib/admin/inventory-count-actions';
import {
  blankProfile,
  currentCount,
  inventoryControls,
} from '@/lib/inventory/controls';
import { getPrisma } from '@/lib/db/prisma';
import { getInventoryReport } from '@/lib/inventory/report';
import styles from '@/components/admin/Admin.module.scss';

const path = '/admin/stocks/inventaire';

async function InventoryAlerts() {
  const report = await getInventoryReport();
  return (
    <>
      <PageHeader
        title="Alertes de stock"
        description="Surveillez les seuils, les comptages et les produits sans vente. Les achats restent à valider."
      >
        <Link className={styles.secondaryButton} href={path}>
          Retour aux comptages
        </Link>
      </PageHeader>
      {report.productsAnalyzed === 0 ? (
        <EmptyState>Aucun produit réel à surveiller pour le moment.</EmptyState>
      ) : (
        <>
          <p>
            {report.productsAnalyzed} variantes suivies ·{' '}
            {report.totals.discrepancies} écarts · {report.countCoverage.stale}{' '}
            à recompter · {report.countCoverage.missing} sans comptage.
          </p>
          {report.limited && <p>Analyse limitée aux 1 500 premiers SKU.</p>}
          <section className={styles.card} aria-labelledby="seuils-stock">
            <h2 id="seuils-stock">
              Seuils atteints ({report.totals.lowStock})
            </h2>
            {report.lowStock.length ? (
              <AdminTable
                caption="Variantes au seuil d’alerte ou en rupture"
                headings={[
                  'Produit / SKU',
                  'Disponible',
                  'Seuil',
                  'Délai',
                  'Action',
                ]}
              >
                {report.lowStock.map((row) => (
                  <tr key={row.sku}>
                    <td>
                      {row.name} · {row.sku}
                    </td>
                    <td>{row.available}</td>
                    <td>{row.threshold}</td>
                    <td>
                      {row.leadTimeDays === null
                        ? 'Inconnu'
                        : `${row.leadTimeDays} j`}
                    </td>
                    <td>{row.recommendation}</td>
                  </tr>
                ))}
              </AdminTable>
            ) : (
              <p>Aucun seuil atteint.</p>
            )}
            {report.totals.lowStock > report.lowStock.length && (
              <p>
                Affichage des {report.lowStock.length} variantes les plus
                proches de la rupture.
              </p>
            )}
          </section>
          <section className={styles.card} aria-labelledby="stock-dormant">
            <h2 id="stock-dormant">
              Stocks dormants ({report.totals.dormant})
            </h2>
            {report.dormant.length ? (
              <AdminTable
                caption="Variantes disponibles sans vente depuis au moins 30 jours"
                headings={[
                  'Produit / SKU',
                  'Disponible',
                  'Sans vente',
                  'Action',
                ]}
              >
                {report.dormant.map((row) => (
                  <tr key={row.sku}>
                    <td>
                      {row.name} · {row.sku}
                    </td>
                    <td>{row.available}</td>
                    <td>
                      {row.days} j · palier {row.band}
                    </td>
                    <td>{row.recommendation}</td>
                  </tr>
                ))}
              </AdminTable>
            ) : (
              <p>Aucun stock dormant.</p>
            )}
            {report.totals.dormant > report.dormant.length && (
              <p>
                Affichage des {report.dormant.length} variantes sans vente
                depuis le plus longtemps.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  if (param(params, 'vue') === 'alertes') return <InventoryAlerts />;
  const page = pageNumber(params);
  const search = param(params, 'search').trim();
  const where = {
    isActive: true,
    product: { isDemonstration: false, status: { not: 'ARCHIVED' as const } },
    ...(search && {
      OR: [
        { sku: { contains: search, mode: 'insensitive' as const } },
        {
          product: { name: { contains: search, mode: 'insensitive' as const } },
        },
      ],
    }),
  };
  const db = getPrisma();
  const [variants, total] = await Promise.all([
    db.productVariant.findMany({
      where,
      orderBy: [{ sku: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sku: true,
        updatedAt: true,
        stockQuantity: true,
        reservedQuantity: true,
        product: { select: { name: true } },
      },
    }),
    db.productVariant.count({ where }),
  ]);
  const { profiles, counts } = await inventoryControls(
    variants.map(({ id }) => id),
  );
  return (
    <>
      <PageHeader
        title="Inventaire physique"
        description="Enregistrez les comptages, les emplacements du garage et les délais confirmés."
      >
        <Link className={styles.secondaryButton} href={`${path}?vue=alertes`}>
          Voir les alertes
        </Link>
        <Link className={styles.secondaryButton} href="/admin/stocks">
          Retour aux stocks
        </Link>
      </PageHeader>
      <p>
        Comptez les articles en rayon, y compris les unités réservées dont la
        commande est encore impayée. Mettez à part les articles des commandes
        déjà payées en attente de préparation.
      </p>
      <form action={path} className={styles.inline}>
        <Field
          label="Chercher un produit ou un SKU"
          name="search"
          type="search"
          maxLength={200}
          defaultValue={search}
        />
        <button className={styles.button} type="submit">
          Rechercher
        </button>
      </form>
      {variants.length === 0 && (
        <EmptyState>
          {search ? (
            'Aucun résultat.'
          ) : (
            <>
              Ajoutez une variante réelle depuis{' '}
              <Link href="/admin/produits">Produits</Link> pour démarrer
              l’inventaire.
            </>
          )}
        </EmptyState>
      )}
      {variants.map((variant) => {
        const profile = profiles.get(variant.id) ?? blankProfile;
        const count = counts.get(variant.id);
        const valid = count && currentCount(count, variant);
        const difference = valid ? count.quantity - variant.stockQuantity : 0;
        const canApprove =
          valid &&
          difference !== 0 &&
          count.quantity >= variant.reservedQuantity;
        return (
          <section
            className={styles.card}
            key={variant.id}
            aria-labelledby={`inventory-${variant.id}`}
          >
            <h2 id={`inventory-${variant.id}`}>
              {variant.product.name} · {variant.sku}
            </h2>
            <p>
              Stock informatique : {variant.stockQuantity} · Réservées :{' '}
              {variant.reservedQuantity} · Emplacement :{' '}
              {profile.location ?? 'à renseigner'}
            </p>
            {count && (
              <p>
                Dernier comptage : {count.quantity} le {formatDate(count.at)} ·{' '}
                {valid
                  ? difference
                    ? `Écart : ${difference > 0 ? '+' : ''}${difference}`
                    : 'Concordant'
                  : 'À recompter depuis le dernier mouvement'}
              </p>
            )}
            {valid && count.quantity < variant.reservedQuantity && (
              <p>
                Correction bloquée : le comptage est inférieur aux réservations.
              </p>
            )}
            <div className={styles.grid}>
              <details>
                <summary>Emplacement et délai fournisseur</summary>
                <AdminForm
                  action={saveInventoryProfileAction}
                  fieldsKey={JSON.stringify(profile)}
                >
                  <Hidden name="variantId" value={variant.id} />
                  <div className={styles.fields}>
                    <Field
                      label="Code d’emplacement"
                      name="location"
                      maxLength={48}
                      placeholder="GAR-A03-B02"
                      defaultValue={profile.location ?? ''}
                    />
                    <Field
                      label="Délai confirmé (jours)"
                      name="leadTimeDays"
                      type="number"
                      min={1}
                      max={365}
                      defaultValue={profile.leadTimeDays ?? ''}
                    />
                  </div>
                </AdminForm>
              </details>
              <details>
                <summary>Enregistrer un comptage</summary>
                <AdminForm
                  action={recordPhysicalCountAction}
                  submit="Enregistrer le comptage"
                  fieldsKey={variant.updatedAt.toISOString()}
                >
                  <Hidden name="variantId" value={variant.id} />
                  <Hidden
                    name="expectedVersion"
                    value={variant.updatedAt.toISOString()}
                  />
                  <Field
                    label="Quantité comptée"
                    name="quantity"
                    type="number"
                    min={0}
                    max={1000000}
                    step={1}
                    required
                  />
                </AdminForm>
              </details>
              {canApprove && (
                <details>
                  <summary>Valider la correction</summary>
                  <AdminForm
                    action={approvePhysicalCountAction}
                    submit="Appliquer la correction"
                    confirm={`Valider le passage de ${variant.stockQuantity} à ${count.quantity} unités ?`}
                  >
                    <Hidden name="variantId" value={variant.id} />
                    <Hidden name="countId" value={count.id} />
                    <Field
                      label="Motif de correction"
                      name="reason"
                      maxLength={500}
                      required
                    />
                  </AdminForm>
                </details>
              )}
            </div>
          </section>
        );
      })}
      <Pagination page={page} total={total} params={params} path={path} />
    </>
  );
}
