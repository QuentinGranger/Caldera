import Image from 'next/image';
import Link from 'next/link';
import {
  getAdminTaxonomy,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import { saveGameAction } from '@/lib/admin/actions';
import {
  GAME_DESCRIPTION_MAX_LENGTH,
  GAME_SHORT_NAME_MAX_LENGTH,
} from '@/lib/admin/limits';
import { faqInput } from '@/lib/admin/seo';
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
import { SeoFields } from '@/components/admin/SeoFields';
import { SlugFields } from '@/components/admin/SlugFields';
import styles from '@/components/admin/Admin.module.scss';
export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getAdminTaxonomy('game', params);
  if (data.kind !== 'game') return null;
  const game = data.editing;
  return (
    <>
      <PageHeader
        title="Jeux"
        description="Licences du catalogue : adresse de la page jeu, ordre du menu et textes de référencement."
      >
        <Link href="/admin/jeux#edition">Créer un jeu</Link>
      </PageHeader>
      <form className={styles.filters} action="/admin/jeux">
        <label>
          Nom
          <input
            name="search"
            defaultValue={param(params, 'search')}
            maxLength={200}
          />
        </label>
        <button type="submit">Rechercher</button>
        <Link href="/admin/jeux">Réinitialiser</Link>
      </form>
      {data.rows.length ? (
        <AdminTable
          caption="Jeux"
          headings={[
            'Jeu',
            'Slug',
            'Ordre',
            'Actif',
            'Extensions',
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
              <td>
                <code>{`/${row.slug}`}</code>
              </td>
              <td>{row.sortOrder}</td>
              <td>{row.isActive ? 'Oui' : 'Non'}</td>
              <td>{row._count.sets}</td>
              <td>{row._count.products}</td>
              <td>
                <Link href={`/admin/jeux?edit=${row.id}#edition`}>
                  Modifier
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>Aucun jeu trouvé.</EmptyState>
      )}
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/jeux"
      />
      <section className={styles.card} id="edition">
        <div className={styles.inline}>
          <h2>{game ? `Modifier : ${game.name}` : 'Nouveau jeu'}</h2>
          {game?.isActive && (
            <Link href={`/${game.slug}`}>Voir sur la boutique ↗</Link>
          )}
        </div>
        <AdminForm
          key={game ? `${game.id}-${game.updatedAt.toISOString()}` : 'new'}
          action={saveGameAction}
          confirm={
            game?.isActive
              ? 'Les produits et les pages de ce jeu ne seront plus visibles sur la boutique. Confirmer ?'
              : undefined
          }
          confirmWhen="inactive"
        >
          {game && <Hidden name="id" value={game.id} />}
          <div className={styles.fields}>
            <SlugFields name={game?.name} slug={game?.slug} />
            <Field
              label="Nom court (menu)"
              name="shortName"
              maxLength={GAME_SHORT_NAME_MAX_LENGTH}
              defaultValue={game?.shortName ?? ''}
            />
            <Field
              label="Ordre d’affichage"
              name="sortOrder"
              type="number"
              required
              min={0}
              max={1000000}
              defaultValue={game?.sortOrder ?? 0}
            />
            <Field
              label="Logo (chemin local)"
              name="logoUrl"
              defaultValue={game?.logoUrl ?? ''}
              placeholder="/assets/images/..."
              maxLength={500}
            />
            <TextField
              label="Accroche courte"
              name="description"
              maxLength={GAME_DESCRIPTION_MAX_LENGTH}
              defaultValue={game?.description}
            />
            <SeoFields
              seoTitle={game?.seoTitle}
              seoDescription={game?.seoDescription}
              editorial={{
                intro: game?.intro,
                faq: faqInput(game?.faq ?? null),
              }}
            />
          </div>
          <div className={styles.checks}>
            <Check
              name="isActive"
              label="Jeu actif"
              checked={game?.isActive ?? true}
            />
          </div>
          <small>
            Le slug devient l’adresse de la page jeu : un changement crée une
            redirection permanente depuis l’ancienne adresse. Les adresses déjà
            utilisées par le site sont refusées.
          </small>
        </AdminForm>
      </section>
    </>
  );
}
