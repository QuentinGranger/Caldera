import { FilterPanel } from '@/components/admin/FilterPanel';
import Image from 'next/image';
import Link from 'next/link';
import {
  ProductLanguage,
  ProductStatus,
  ProductType,
} from '@/generated/prisma/client';
import {
  getAdminOptions,
  getAdminProducts,
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
  const [data, options] = await Promise.all([
    getAdminProducts(params),
    getAdminOptions(),
  ]);
  const enums = (values: string[]) =>
    values.map((value) => ({ value, label: label(value) }));
  return (
    <>
      <PageHeader
        title="Produits"
        description="Catalogue, variantes et publication."
      >
        <Link className={styles.button} href="/admin/produits/nouveau">
          Créer un produit
        </Link>
      </PageHeader>
      <FilterPanel
        action="/admin/produits"
        search={param(params, 'search')}
        placeholder="Nom, slug, SKU ou EAN"
        activeCount={
          [
            'status',
            'productType',
            'categoryId',
            'tcgSetId',
            'language',
            'availability',
            'sort',
          ].filter((key) => param(params, key)).length
        }
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
            'SKU principal',
            'Type / catégorie',
            'Extension',
            'Statut',
            'Prix dès',
            'Disponible',
            'Mise à jour',
          ]}
        >
          {data.products.map((product) => (
            <tr key={product.id}>
              <td>
                <div className={styles.inline}>
                  {product.images[0] && (
                    <Image
                      src={product.images[0].url}
                      alt=""
                      width={45}
                      height={55}
                    />
                  )}
                  <Link href={`/admin/produits/${product.id}`}>
                    {product.name}
                  </Link>
                </div>
              </td>
              <td>
                <code>{product.variants[0]?.sku ?? '—'}</code>
              </td>
              <td>
                {label(product.productType)}
                <small>{product.category.name}</small>
              </td>
              <td>{product.tcgSet?.name ?? '—'}</td>
              <td>
                <Badge value={product.status} />
              </td>
              <td>{euros(product.price)}</td>
              <td>{product.available}</td>
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
