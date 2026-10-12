import Image from 'next/image';
import Link from 'next/link';
import {
  BellRing,
  CircleAlert,
  Package,
  PackageX,
  SlidersHorizontal,
  Warehouse,
  X,
} from 'lucide-react';
import { adminListHref } from '@/lib/admin/list-url';
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
  Badge,
} from '@/components/admin/AdminUI';
import {
  StockCorrectionForm,
  StockDeltaForm,
} from '@/components/admin/StockAdjustmentForms';
import { StockAdjustmentPanel } from '@/components/admin/StockAdjustmentPanel';
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
  const views = [
    {
      value: 'out',
      label: 'Ruptures',
      count: counts.out,
      hint: 'Aucune unité disponible',
      icon: PackageX,
      tone: 'danger',
    },
    {
      value: 'low',
      label: 'Stock faible',
      count: counts.low,
      hint: 'Sous le seuil ou à sa limite',
      icon: CircleAlert,
      tone: 'pending',
    },
    {
      value: 'alerts',
      label: 'Demandes clients',
      count: counts.alerts,
      hint: 'Variantes avec alertes confirmées',
      icon: BellRing,
      tone: 'info',
    },
    {
      value: 'reserved',
      label: 'Réservations',
      count: counts.reserved,
      hint: 'Variantes avec unités réservées',
      icon: Warehouse,
      tone: 'neutral',
    },
  ];
  const availability = views.some(
    (view) => view.value === param(params, 'availability'),
  )
    ? param(params, 'availability')
    : '';
  const view = views.find((item) => item.value === availability);
  const status = ['active', 'inactive'].includes(param(params, 'status'))
    ? param(params, 'status')
    : '';
  const sort = ['stock_asc', 'stock_desc', 'name'].includes(
    param(params, 'sort'),
  )
    ? param(params, 'sort')
    : 'stock_asc';
  const editing = data.editing;
  const closeHref = adminListHref('/admin/stocks', params, {
    adjust: undefined,
    page: data.page > 1 ? String(data.page) : undefined,
  });
  return (
    <>
      <PageHeader
        title="Stocks"
        description="Repérez les réassorts prioritaires et ajustez vos quantités sans perdre de vue les réservations."
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/produits"
        >
          Gérer les produits
        </Link>
      </PageHeader>
      <nav className={styles.stockViews} aria-label="Vues stocks">
        {views.map(({ icon: Icon, ...item }) => (
          <Link
            key={item.value}
            href={adminListHref('/admin/stocks', params, {
              availability: item.value,
              adjust: undefined,
            })}
            aria-current={availability === item.value ? 'page' : undefined}
            data-tone={item.tone}
          >
            <span className={styles.stockViewLabel}>
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </span>
            <strong>{item.count}</strong>
            <small>{item.hint}</small>
          </Link>
        ))}
      </nav>
      <div className={styles.stockListHeading}>
        <div>
          <h2>{view?.label ?? 'Tout l’inventaire'}</h2>
          <p>
            {data.total} variante{data.total > 1 ? 's' : ''} dans cette vue ·
            compteurs ci-dessus sur tout l’inventaire.
          </p>
        </div>
        {availability && (
          <Link
            href={adminListHref('/admin/stocks', params, {
              availability: undefined,
              adjust: undefined,
            })}
          >
            Tout l’inventaire
          </Link>
        )}
      </div>
      <FilterPanel
        action="/admin/stocks"
        search={param(params, 'search')}
        placeholder="Nom du produit ou SKU"
        keep={{ availability }}
        params={params}
        activeCount={Number(Boolean(status)) + Number(sort !== 'stock_asc')}
        criteria={[
          ...(status
            ? [
                {
                  name: 'status',
                  label:
                    status === 'active'
                      ? 'Variantes actives'
                      : 'Variantes inactives',
                },
              ]
            : []),
          ...(sort !== 'stock_asc'
            ? [
                {
                  name: 'sort',
                  label:
                    sort === 'name'
                      ? 'Tri : nom du produit'
                      : 'Tri : disponible décroissant',
                },
              ]
            : []),
        ]}
      >
        <label>
          État de la variante
          <select name="status" defaultValue={status}>
            <option value="">Toutes les variantes</option>
            <option value="active">Actives</option>
            <option value="inactive">Inactives</option>
          </select>
        </label>
        <label>
          Trier par
          <select name="sort" defaultValue={sort}>
            <option value="stock_asc">Disponible : croissant</option>
            <option value="stock_desc">Disponible : décroissant</option>
            <option value="name">Nom du produit</option>
          </select>
        </label>
      </FilterPanel>
      {editing && (
        <section
          className={`${styles.card} ${styles.stockEditor}`}
          id="ajustement"
          aria-labelledby="stock-editor-title"
        >
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Ajustement de stock</span>
              <h2 id="stock-editor-title">{editing.product.name}</h2>
              <code>{editing.sku}</code> · {label(editing.language)}
            </div>
            <Link
              className={styles.stockClose}
              href={closeHref}
              aria-label="Fermer l’ajustement"
            >
              <X size={19} aria-hidden="true" />
              Fermer
            </Link>
          </header>
          <dl className={styles.stockSnapshot}>
            <div>
              <dt>Physique</dt>
              <dd>{editing.stockQuantity}</dd>
            </div>
            <div>
              <dt>Réservé</dt>
              <dd>{editing.reservedQuantity}</dd>
            </div>
            <div>
              <dt>Disponible</dt>
              <dd>{editing.availableQuantity}</dd>
            </div>
          </dl>
          <StockAdjustmentPanel
            key={editing.id}
            adjustment={
              <StockDeltaForm
                key={`delta-${editing.stockQuantity}`}
                variantId={editing.id}
              />
            }
            correction={
              <StockCorrectionForm
                key={`absolute-${editing.stockQuantity}`}
                variantId={editing.id}
                stock={editing.stockQuantity}
              />
            }
          />
          <Link
            className={styles.stockHistoryLink}
            href={`/admin/produits/${editing.productId}#variantes`}
          >
            Consulter l’historique et les réservations du produit ↗
          </Link>
        </section>
      )}
      {param(params, 'adjust') && !editing && (
        <p className={styles.message} role="alert">
          Cette variante est introuvable.{' '}
          <Link href={closeHref}>Revenir à l’inventaire</Link>
        </p>
      )}
      <div className={styles.stockLegend}>
        <Warehouse size={16} aria-hidden="true" />
        <span>
          <strong>Disponible = physique − réservé.</strong> Les quantités
          réservées sont gérées par les commandes.
        </span>
      </div>
      {data.variants.length ? (
        <AdminTable
          caption="Stocks par variante"
          headings={[
            'Produit / variante',
            'Physique',
            'Réservé',
            'Disponible',
            'Demandes',
            'Action',
          ]}
        >
          {data.variants.map((variant) => (
            <tr
              key={variant.id}
              data-editing={editing?.id === variant.id ? '' : undefined}
            >
              <td>
                <div className={styles.productCell}>
                  {variant.product.images[0] ? (
                    <Image
                      src={variant.product.images[0].url}
                      alt=""
                      width={48}
                      height={56}
                    />
                  ) : (
                    <span className={styles.productPlaceholder}>
                      <Package size={23} aria-hidden="true" />
                    </span>
                  )}
                  <div>
                    <Link
                      href={`/admin/produits/${variant.productId}#variantes`}
                    >
                      {variant.product.name}
                    </Link>
                    <small>
                      <code>{variant.sku}</code> · {label(variant.language)}
                    </small>
                    <div className={styles.stockProductBadges}>
                      {variant.product.status !== 'ACTIVE' && (
                        <Badge value={variant.product.status} />
                      )}
                      {!variant.isActive && (
                        <span className={styles.badge}>Variante inactive</span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <span className={styles.stockNumber}>
                  {variant.stockQuantity}
                </span>
              </td>
              <td>
                <span className={styles.stockNumber}>
                  {variant.reservedQuantity}
                </span>
                <small>
                  {variant._count.reservations} réservation
                  {variant._count.reservations > 1 ? 's' : ''}
                </small>
              </td>
              <td>
                <span className={styles.stockAvailable}>
                  {variant.availableQuantity}
                </span>
                <small
                  className={`${styles.stockState} ${variant.availableQuantity === 0 ? styles.stockOut : variant.availableQuantity <= variant.lowStockThreshold ? styles.stockLow : styles.stockHealthy}`}
                >
                  {variant.availableQuantity === 0
                    ? 'Rupture'
                    : variant.availableQuantity <= variant.lowStockThreshold
                      ? 'Stock faible'
                      : 'En stock'}
                </small>
                <small>Seuil : {variant.lowStockThreshold}</small>
              </td>
              <td>
                {variant._count.stockAlerts ? (
                  <span className={styles.stockDemand}>
                    <BellRing size={14} aria-hidden="true" />
                    {variant._count.stockAlerts}
                  </span>
                ) : (
                  <span className={styles.muted}>—</span>
                )}
                <small>
                  {variant._count.stockAlerts
                    ? 'clients en attente'
                    : 'Aucune alerte'}
                </small>
              </td>
              <td>
                <Link
                  className={`${styles.button} ${styles.secondaryButton} ${styles.stockAdjustLink}`}
                  href={
                    adminListHref('/admin/stocks', params, {
                      adjust: variant.id,
                      page: data.page > 1 ? String(data.page) : undefined,
                    }) + '#ajustement'
                  }
                  aria-label={`Ajuster ${variant.sku}`}
                >
                  <SlidersHorizontal size={15} aria-hidden="true" />
                  Ajuster
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>
          {availability || param(params, 'search') || status
            ? 'Aucune variante ne correspond à cette vue. Vous pouvez modifier les filtres ou revenir à tout l’inventaire.'
            : 'Votre inventaire apparaîtra ici dès la création des premières variantes produit.'}
        </EmptyState>
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
