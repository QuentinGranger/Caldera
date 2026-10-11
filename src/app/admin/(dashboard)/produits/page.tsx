import { FilterPanel } from '@/components/admin/FilterPanel';
import Image from 'next/image';
import { Package, Plus } from 'lucide-react';
import { adminListHref } from '@/lib/admin/list-url';
import Link from 'next/link';
import {
  ProductLanguage,
  ProductStatus,
  ProductType,
} from '@/generated/prisma/client';
import {
  getAdminOptions,
  getAdminProducts,
  getProductStatusCounts,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import { euros, formatDate, label } from '@/lib/admin/format';
import {
  PageHeader,
  Badge,
  AdminTable,
  Pagination,
  EmptyState,
  FilterSelect,
} from '@/components/admin/AdminUI';
import styles from '@/components/admin/Admin.module.scss';
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [data, options, counts] = await Promise.all([
    getAdminProducts(params),
    getAdminOptions(),
    getProductStatusCounts(),
  ]);
  const status = param(params, 'status');
  const tabs = [
    {
      value: '',
      label: 'Tous',
      count: counts.DRAFT + counts.ACTIVE + counts.ARCHIVED,
    },
    { value: 'ACTIVE', label: 'Publiés', count: counts.ACTIVE },
    { value: 'DRAFT', label: 'Brouillons', count: counts.DRAFT },
    { value: 'ARCHIVED', label: 'Archivés', count: counts.ARCHIVED },
  ];
  // The status is a tab, the default order no criterion: neither opens
  // the filters.
  const sort = param(params, 'sort');
  const activeCount =
    [
      'productType',
      'categoryId',
      'tcgSetId',
      'language',
      'availability',
      'visibility',
    ].filter((key) => param(params, key)).length +
    (sort && sort !== 'updated' ? 1 : 0);
  const enums = (values: string[]) =>
    values.map((value) => ({ value, label: label(value) }));
  const filterDefinitions: [string, string][] = [
    ['productType', 'Type'],
    ['categoryId', 'Catégorie'],
    ['tcgSetId', 'Extension'],
    ['language', 'Langue'],
    ['availability', 'Disponibilité'],
    ['visibility', 'Boutique'],
    ['sort', 'Tri'],
  ];
  return (
    <>
      <PageHeader
        title="Produits"
        description="Catalogue, variantes et publication."
      >
        <Link className={styles.button} href="/admin/produits/nouveau">
          <Plus size={17} aria-hidden="true" /> Créer un produit
        </Link>
      </PageHeader>
      <nav className={styles.tabs} aria-label="Statut des produits">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={adminListHref('/admin/produits', params, {
              status: tab.value,
            })}
            aria-current={status === tab.value ? 'page' : undefined}
          >
            {tab.label}
            <span className={styles.tabCount}>{tab.count}</span>
          </Link>
        ))}
      </nav>
      <FilterPanel
        action="/admin/produits"
        search={param(params, 'search')}
        placeholder="Nom, slug, SKU ou EAN"
        activeCount={activeCount}
        params={params}
        criteria={filterDefinitions
          .filter(
            ([name]) =>
              param(params, name) && (name !== 'sort' || sort !== 'updated'),
          )
          .map(([name, title]) => {
            const value = param(params, name);
            const names: Record<string, string> = {
              in: 'En stock',
              out: 'Rupture',
              low: 'Stock faible',
              hidden: 'Invisibles',
              created: 'Création récente',
              name: 'Nom A–Z',
              price: 'Prix croissant',
              stock: 'Stock croissant',
            };
            const text =
              name === 'categoryId'
                ? options.categories.find((item) => item.id === value)?.name
                : name === 'tcgSetId'
                  ? options.sets.find((item) => item.id === value)?.name
                  : (names[value] ?? label(value));
            return { name, label: `${title} : ${text ?? value}` };
          })}
      >
        <FilterSelect
          name="status"
          label="Statut"
          value={param(params, 'status')}
          options={enums(Object.values(ProductStatus))}
        />
        <FilterSelect
          name="productType"
          label="Type"
          value={param(params, 'productType')}
          options={enums(Object.values(ProductType))}
        />
        <FilterSelect
          name="categoryId"
          label="Catégorie"
          value={param(params, 'categoryId')}
          options={options.categories.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
        <FilterSelect
          name="tcgSetId"
          label="Extension"
          value={param(params, 'tcgSetId')}
          options={options.sets.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
        <FilterSelect
          name="language"
          label="Langue"
          value={param(params, 'language')}
          options={enums(Object.values(ProductLanguage))}
        />
        <FilterSelect
          name="availability"
          label="Disponibilité"
          value={param(params, 'availability')}
          options={[
            { value: 'in', label: 'En stock' },
            { value: 'out', label: 'Rupture' },
            { value: 'low', label: 'Stock faible' },
          ]}
        />
        <FilterSelect
          name="visibility"
          label="Boutique"
          value={param(params, 'visibility')}
          options={[{ value: 'hidden', label: 'Publiés mais invisibles' }]}
        />
        <label>
          Trier
          <select name="sort" defaultValue={param(params, 'sort') || 'updated'}>
            <option value="updated">Dernière modification</option>
            <option value="created">Création récente</option>
            <option value="name">Nom A–Z</option>
            <option value="price">Prix croissant</option>
            <option value="stock">Stock croissant</option>
          </select>
        </label>
      </FilterPanel>
      {data.products.length ? (
        <AdminTable
          caption="Produits"
          headings={[
            'Produit',
            'Statut',
            'Prix dès',
            'Disponible',
            'Mise à jour',
          ]}
        >
          {data.products.map((product) => (
            <tr key={product.id}>
              <td>
                <div className={styles.productCell}>
                  <span className={styles.productThumbnail}>
                    {product.images[0] ? (
                      <Image
                        src={product.images[0].url}
                        alt=""
                        width={48}
                        height={58}
                      />
                    ) : (
                      <Package size={23} strokeWidth={1.4} aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <Link href={`/admin/produits/${product.id}`}>
                      {product.name}
                    </Link>
                    <small>
                      {[
                        label(product.productType),
                        product.category.name,
                        product.tcgSet?.name,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                    <code className={styles.cellMeta}>
                      {product.variants[0]?.sku ?? 'Sans SKU'}
                    </code>
                  </div>
                </div>
              </td>
              <td>
                <Badge value={product.status} />
                {product.hidden && (
                  <span
                    className={`${styles.badge} ${styles.danger}`}
                    title="Publié, mais absent de la boutique : ouvrez le produit pour voir pourquoi."
                  >
                    Invisible en boutique
                  </span>
                )}
              </td>
              <td>
                <strong className={styles.cellAmount}>
                  {euros(product.price)}
                </strong>
              </td>
              <td>
                {product.available > 0 ? (
                  <strong className={styles.stockNumber}>
                    {product.available}
                  </strong>
                ) : (
                  <span className={`${styles.badge} ${styles.danger}`}>
                    Rupture
                  </span>
                )}
              </td>
              <td>{formatDate(product.updatedAt)}</td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>
          Aucun produit trouvé.{' '}
          <Link href="/admin/produits/nouveau">Créer un produit</Link> ou{' '}
          <Link href="/admin/produits">réinitialiser les filtres</Link>.
        </EmptyState>
      )}
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/produits"
      />
      <small>
        Prix et disponibilité agrégés sur les variantes actives. Dates :
        Europe/Paris.
      </small>
    </>
  );
}
