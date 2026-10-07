import Link from 'next/link';
import { FilterPanel } from '@/components/admin/FilterPanel';
import {
  getAdminStocks,
  getStockViewCounts,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import { label } from '@/lib/admin/format';
import {
  PageHeader,
  AdminTable,
  Pagination,
  EmptyState,
} from '@/components/admin/AdminUI';
import { StockAdjustmentForms } from '@/components/admin/StockAdjustmentForms';
import styles from '@/components/admin/Admin.module.scss';
export default async function StocksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [data, counts] = await Promise.all([
    getAdminStocks(params),
    getStockViewCounts(),
  ]);
  const availability = param(params, 'availability');
  const views = [
    { value: '', label: 'Toutes' },
    { value: 'out', label: 'Ruptures', count: counts.out },
    { value: 'low', label: 'Stock faible', count: counts.low },
    { value: 'alerts', label: 'Demandes clients', count: counts.alerts },
    { value: 'reserved', label: 'Réservées', count: counts.reserved },
  ];
  return (
    <>
      <PageHeader
        title="Stocks"
        description="Disponible = stock physique − quantités réservées. Les réservations sont gérées par le paiement."
      />
      <nav className={styles.tabs} aria-label="Vues stocks">
        {views.map((view) => (
          <Link
            key={view.label}
            href={
              view.value
                ? `/admin/stocks?availability=${view.value}`
                : '/admin/stocks'
            }
            aria-current={availability === view.value ? 'page' : undefined}
          >
            {view.label}
            {view.count !== undefined && (
              <span className={styles.tabCount}>{view.count}</span>
            )}
          </Link>
        ))}
      </nav>
      <FilterPanel
        action="/admin/stocks"
        search={param(params, 'search')}
        placeholder="Produit ou SKU"
        keep={{ availability }}
      />
      {data.variants.length ? (
        <AdminTable
          caption="Stocks par variante"
          headings={[
            'Produit / SKU',
            'Langue',
            'Physique',
            'Réservé',
            'Disponible',
            'Seuil',
            'État',
            'Alertes',
            'Ajustements',
          ]}
        >
          {data.variants.map((variant) => (
            <tr key={variant.id}>
              <td>
                <Link href={`/admin/produits/${variant.productId}#variantes`}>
                  {variant.product.name}
                </Link>
                <small>
                  <code>{variant.sku}</code>
                </small>
              </td>
              <td>{label(variant.language)}</td>
              <td>{variant.stockQuantity}</td>
              <td>
                {variant.reservedQuantity}
                <small>
                  {variant._count.reservations > 1
                    ? `${variant._count.reservations} réservations`
                    : `${variant._count.reservations} réservation`}
                </small>
              </td>
              <td>
                <strong>{variant.availableQuantity}</strong>
              </td>
              <td>{variant.lowStockThreshold}</td>
              <td>
                <span
                  className={`${styles.badge} ${!variant.isActive ? '' : variant.availableQuantity === 0 ? styles.danger : variant.availableQuantity <= variant.lowStockThreshold ? styles.pending : styles.success}`}
                >
                  {!variant.isActive
                    ? 'Inactive'
                    : variant.availableQuantity === 0
                      ? 'Rupture'
                      : variant.availableQuantity <= variant.lowStockThreshold
                        ? 'Stock faible'
                        : 'En stock'}
                </span>
              </td>
              <td>
                {variant._count.stockAlerts}
                <small>
                  {variant._count.stockAlerts > 1
                    ? 'clients en attente'
                    : variant._count.stockAlerts === 1
                      ? 'client en attente'
                      : 'aucune demande'}
                </small>
              </td>
              <td>
                <details>
                  <summary>Ajuster</summary>
                  <StockAdjustmentForms
                    key={variant.stockQuantity}
                    variantId={variant.id}
                    stock={variant.stockQuantity}
                  />
                  <Link href={`/admin/produits/${variant.productId}#variantes`}>
                    Historique et réservations
                  </Link>
                </details>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>Aucune variante trouvée.</EmptyState>
      )}
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/stocks"
      />
    </>
  );
}
