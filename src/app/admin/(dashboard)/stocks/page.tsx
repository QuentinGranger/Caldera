import Link from 'next/link';
import { getAdminStocks, param, type SearchParams } from '@/lib/admin/queries';
import { label } from '@/lib/admin/format';
import {
  PageHeader,
  AdminTable,
  Pagination,
  EmptyState,
  FilterSelect,
} from '@/components/admin/AdminUI';
import { StockAdjustmentForms } from '@/components/admin/StockAdjustmentForms';
import styles from '@/components/admin/Admin.module.scss';
export default async function StocksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getAdminStocks(params);
  return (
    <>
      <PageHeader
        title="Stocks"
        description="Disponible = stock physique − quantités réservées. Les réservations sont gérées par le paiement."
      />
      <form className={styles.filters} action="/admin/stocks">
        <label>
          Rechercher
          <input
            name="search"
            defaultValue={param(params, 'search')}
            placeholder="Produit ou SKU"
            maxLength={200}
          />
        </label>
        <FilterSelect
          name="availability"
          label="Disponibilité"
          value={param(params, 'availability')}
          options={[
            { value: 'out', label: 'Rupture' },
            { value: 'low', label: 'Stock faible' },
            { value: 'reserved', label: 'Avec réservations' },
          ]}
        />
        <button type="submit">Filtrer</button>
        <Link href="/admin/stocks">Réinitialiser</Link>
      </form>
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
                <small>{variant._count.reservations} réservation(s)</small>
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
