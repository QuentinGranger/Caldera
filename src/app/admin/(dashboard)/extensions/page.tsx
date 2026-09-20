import Image from 'next/image';
import Link from 'next/link';
import {
  getAdminTaxonomy,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import { saveSetAction } from '@/lib/admin/actions';
import { dateInput } from '@/lib/admin/format';
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
  TextField,
} from '@/components/admin/AdminFields';
import { SlugFields } from '@/components/admin/SlugFields';
import styles from '@/components/admin/Admin.module.scss';
export default async function SetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getAdminTaxonomy('set', params);
  if (data.kind !== 'set') return null;
  const set = data.editing;
  return (
    <>
      <PageHeader
        title="Extensions"
        description="Séries, codes et dates de sortie."
      >
        <Link href="/admin/extensions#edition">Créer une extension</Link>
      </PageHeader>
      <form className={styles.filters} action="/admin/extensions">
        <label>
          Nom
          <input
            name="search"
            defaultValue={param(params, 'search')}
            maxLength={200}
          />
        </label>
        <button type="submit">Rechercher</button>
        <Link href="/admin/extensions">Réinitialiser</Link>
      </form>
      {data.rows.length ? (
        <AdminTable
          caption="Extensions"
          headings={[
            'Extension',
            'Code',
            'Série',
            'Sortie',
            'Active',
            'Produits',
            'Action',
          ]}
        >
          {data.rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className={styles.inline}>
                  {row.logoUrl && (
                    <Image src={row.logoUrl} alt="" width={60} height={40} />
                  )}
                  {row.name}
                </div>
              </td>
              <td>{row.code ?? '—'}</td>
              <td>{row.series ?? '—'}</td>
              <td>
                {row.releaseDate
                  ? row.releaseDate.toLocaleDateString('fr-FR', {
                      timeZone: 'Europe/Paris',
                    })
                  : '—'}
              </td>
              <td>{row.isActive ? 'Oui' : 'Non'}</td>
              <td>{row._count.products}</td>
              <td>
                <Link href={`/admin/extensions?edit=${row.id}#edition`}>
                  Modifier
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>Aucune extension trouvée.</EmptyState>
      )}
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/extensions"
      />
      <section className={styles.card} id="edition">
        <h2>{set ? `Modifier : ${set.name}` : 'Nouvelle extension'}</h2>
        <AdminForm
          key={set ? `${set.id}-${set.updatedAt.toISOString()}` : 'new'}
          action={saveSetAction}
          confirm={
            set?.isActive
              ? 'Les produits de cette extension ne seront plus visibles sur la boutique. Confirmer ?'
              : undefined
          }
          confirmWhen="inactive"
        >
          {set && <Hidden name="id" value={set.id} />}
          <div className={styles.fields}>
            <SlugFields name={set?.name} slug={set?.slug} />
            <Field
              label="Code"
              name="code"
              maxLength={50}
              defaultValue={set?.code ?? ''}
            />
            <Field
              label="Série"
              name="series"
              maxLength={200}
              defaultValue={set?.series ?? ''}
            />
            <Field
              label="Date de sortie"
              name="releaseDate"
              type="date"
              defaultValue={dateInput(set?.releaseDate)}
            />
            <Field
              label="Logo (chemin local)"
              name="logoUrl"
              defaultValue={set?.logoUrl ?? ''}
              placeholder="/assets/images/..."
              maxLength={500}
            />
            <Field
              label="Symbole (chemin local)"
              name="symbolUrl"
              defaultValue={set?.symbolUrl ?? ''}
              placeholder="/assets/images/..."
              maxLength={500}
            />
            <TextField
              label="Description"
              name="description"
              defaultValue={set?.description}
            />
          </div>
          <div className={styles.checks}>
            <Check
              name="isActive"
              label="Extension active"
              checked={set?.isActive ?? true}
            />
          </div>
          <small>
            Assets locaux /assets/ ou images téléversées /media/. Aucun
            téléchargement externe automatique.
          </small>
        </AdminForm>
      </section>
    </>
  );
}
