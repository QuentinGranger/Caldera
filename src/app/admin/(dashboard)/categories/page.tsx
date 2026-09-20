import Link from 'next/link';
import {
  getAdminOptions,
  getAdminTaxonomy,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import { saveCategoryAction } from '@/lib/admin/actions';
import {
  PageHeader,
  AdminTable,
  Pagination,
  EmptyState,
} from '@/components/admin/AdminUI';
import { AdminForm } from '@/components/admin/AdminForm';
import {
  Check,
  Field,
  Hidden,
  SelectField,
  TextField,
} from '@/components/admin/AdminFields';
import { SlugFields } from '@/components/admin/SlugFields';
import styles from '@/components/admin/Admin.module.scss';
export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [data, options] = await Promise.all([
    getAdminTaxonomy('category', params),
    getAdminOptions(),
  ]);
  if (data.kind !== 'category') return null;
  const category = data.editing;
  return (
    <>
      <PageHeader
        title="Catégories"
        description="Organisez les territoires du catalogue. La désactivation conserve les produits."
      >
        <Link href="/admin/categories#edition">Créer une catégorie</Link>
      </PageHeader>
      <form className={styles.filters} action="/admin/categories">
        <label>
          Nom
          <input
            name="search"
            defaultValue={param(params, 'search')}
            maxLength={200}
          />
        </label>
        <button type="submit">Rechercher</button>
        <Link href="/admin/categories">Réinitialiser</Link>
      </form>
      {data.rows.length ? (
        <AdminTable
          caption="Catégories"
          headings={[
            'Nom',
            'Slug',
            'Parent',
            'Ordre',
            'Active',
            'Produits',
            'Action',
          ]}
        >
          {data.rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.slug}</td>
              <td>{row.parent?.name ?? '—'}</td>
              <td>{row.sortOrder}</td>
              <td>{row.isActive ? 'Oui' : 'Non'}</td>
              <td>{row._count.products}</td>
              <td>
                <Link href={`/admin/categories?edit=${row.id}#edition`}>
                  Modifier
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>Aucune catégorie trouvée.</EmptyState>
      )}
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/categories"
      />
      <section className={styles.card} id="edition">
        <h2>
          {category ? `Modifier : ${category.name}` : 'Nouvelle catégorie'}
        </h2>
        <AdminForm
          key={
            category
              ? `${category.id}-${category.updatedAt.toISOString()}`
              : 'new'
          }
          action={saveCategoryAction}
          confirm={
            category?.isActive
              ? 'Les produits de cette catégorie ne seront plus visibles sur la boutique. Confirmer ?'
              : undefined
          }
          confirmWhen="inactive"
        >
          {category && <Hidden name="id" value={category.id} />}
          <div className={styles.fields}>
            <SlugFields name={category?.name} slug={category?.slug} />
            <SelectField
              label="Catégorie parente"
              name="parentId"
              defaultValue={category?.parentId ?? ''}
            >
              <option value="">Aucune</option>
              {options.categories
                .filter((row) => row.id !== category?.id)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </SelectField>
            <Field
              label="Ordre d’affichage"
              name="sortOrder"
              type="number"
              required
              min={0}
              max={1000000}
              defaultValue={category?.sortOrder ?? 0}
            />
            <TextField
              label="Description"
              name="description"
              defaultValue={category?.description}
            />
          </div>
          <div className={styles.checks}>
            <Check
              name="isActive"
              label="Catégorie active"
              checked={category?.isActive ?? true}
            />
          </div>
        </AdminForm>
      </section>
    </>
  );
}
