import { SHOPPING_INTENTS, isIntentTag } from '@/lib/catalog/merchandising';
import { ProductType } from '@/generated/prisma/client';
import { preordersEnabled } from '@/lib/catalog/preorders';
import { saveProductAction } from '@/lib/admin/actions';
import { dateInput, label } from '@/lib/admin/format';
import type { getAdminOptions, getAdminProduct } from '@/lib/admin/queries';
import { AdminForm } from './AdminForm';
import { FormSection } from './AdminUI';
import { Field, SelectField, TextField, Check, Hidden } from './AdminFields';
import { GameSetFields } from './GameSetFields';
import { SeoFields } from './SeoFields';
import { SlugFields } from './SlugFields';
import styles from './Admin.module.scss';
export type AdminProduct = NonNullable<
  Awaited<ReturnType<typeof getAdminProduct>>
>;
export function ProductInformationForm({
  product,
  options,
}: {
  product?: AdminProduct;
  options: Awaited<ReturnType<typeof getAdminOptions>>;
}) {
  return (
    <AdminForm
      action={saveProductAction}
      submit={product ? 'Enregistrer les informations' : 'Créer le brouillon'}
    >
      {product && (
        <>
          <Hidden name="id" value={product.id} />
          <Hidden name="version" value={product.updatedAt.toISOString()} />
        </>
      )}
      <FormSection
        number="01"
        title="Présentation"
        description="Le nom et les descriptions visibles sur la fiche produit."
      >
        <div className={styles.fields}>
          <SlugFields name={product?.name} slug={product?.slug} />
          <TextField
            label="Description courte"
            name="shortDescription"
            defaultValue={product?.shortDescription}
            maxLength={500}
          />
          <TextField
            label="Description"
            name="description"
            defaultValue={product?.description}
            maxLength={20000}
          />
        </div>
      </FormSection>
      <FormSection
        number="02"
        title="Organisation"
        description="Classez le produit pour le retrouver dans les bonnes collections."
      >
        <div className={styles.fields}>
          <SelectField
            label="Type"
            name="productType"
            defaultValue={product?.productType ?? 'BOOSTER'}
            required
          >
            {Object.values(ProductType).map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Catégorie"
            name="categoryId"
            defaultValue={product?.categoryId ?? ''}
            required
          >
            <option value="">Choisir une catégorie</option>
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {!category.isActive ? ' (inactive)' : ''}
              </option>
            ))}
          </SelectField>
          <GameSetFields
            games={options.games}
            sets={options.sets}
            tcgSetId={product?.tcgSetId ?? ''}
            gameId={product?.gameId ?? ''}
          />
          <Field
            label="Tags, séparés par une virgule"
            name="tags"
            defaultValue={product?.tags
              .filter((tag) => !isIntentTag(tag.slug))
              .map((tag) => tag.name)
              .join(', ')}
            maxLength={500}
          />
          <Field
            label="Date de sortie"
            name="releaseDate"
            type="date"
            defaultValue={dateInput(product?.releaseDate)}
          />
          <Field
            label="Date de publication (éditoriale)"
            name="publishedAt"
            type="date"
            defaultValue={dateInput(product?.publishedAt)}
          />
        </div>
      </FormSection>
      <FormSection
        number="03"
        title="Mise en avant"
        description="Choisissez les sélections et les parcours dans lesquels le présenter."
      >
        <div className={styles.checks}>
          <Check
            name="featured"
            label="Sélection du moment"
            checked={product?.featured}
          />
          <Check
            name="newArrival"
            label="Nouveauté de la semaine"
            checked={product?.newArrival}
          />
          {preordersEnabled() ? (
            <Check
              name="preorder"
              label="Précommande"
              checked={product?.preorder}
            />
          ) : product?.preorder ? (
            <Hidden name="preorder" value="on" />
          ) : null}
        </div>
        <h3 className={styles.fieldGroupTitle}>Aider le client à choisir</h3>
        <Hidden name="merchandisingConfigured" value="on" />
        <div className={styles.checks}>
          {SHOPPING_INTENTS.map((intent) => (
            <Check
              key={intent.slug}
              name={intent.slug}
              label={intent.title}
              checked={product?.tags.some((tag) => tag.slug === intent.slug)}
            />
          ))}
        </div>
        <small>
          Choisissez les parcours adaptés au contenu réel du produit. Vous
          pouvez en cocher plusieurs ou aucun. « À garder scellé » est réservé
          aux produits scellés et ne promet aucune plus-value.
        </small>
        <details className={styles.formHelp}>
          <summary>Comprendre les règles de mise en avant</summary>
          <small>
            La nouveauté de la semaine disparaît après 7 jours suivant la date
            de publication. Les derniers exemplaires dépendent du stock
            disponible et de son seuil d’alerte. Les retours en stock exigent un
            réapprovisionnement après rupture documentée dans les 30 derniers
            jours ; un tag « réassort » ne suffit pas. Les produits d’exemple ne
            créent aucune urgence commerciale.
          </small>
          {!preordersEnabled() && (
            <small>
              Les précommandes sont désactivées au lancement. Les produits déjà
              marqués en précommande restent masqués sur le site et ne peuvent
              pas être achetés.
            </small>
          )}
          <small>
            La visibilité dépend du statut de publication. La date éditoriale ne
            programme pas une mise en ligne.
          </small>
        </details>
      </FormSection>
      <FormSection
        number="04"
        title="Référencement"
        description="Facultatif : laissez vide pour utiliser les textes générés depuis le catalogue."
      >
        <div className={styles.fields}>
          <SeoFields
            seoTitle={product?.seoTitle}
            seoDescription={product?.seoDescription}
          />
        </div>
      </FormSection>
    </AdminForm>
  );
}
