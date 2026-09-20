import { ProductType } from '@/generated/prisma/client';
import { saveProductAction } from '@/lib/admin/actions';
import { dateInput, label } from '@/lib/admin/format';
import type { getAdminOptions, getAdminProduct } from '@/lib/admin/queries';
import { AdminForm } from './AdminForm';
import { Field, SelectField, TextField, Check, Hidden } from './AdminFields';
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
      <h3>Organisation</h3>
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
        <SelectField
          label="Extension"
          name="tcgSetId"
          defaultValue={product?.tcgSetId ?? ''}
        >
          <option value="">Aucune extension</option>
          {options.sets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
              {!set.isActive ? ' (inactive)' : ''}
            </option>
          ))}
        </SelectField>
        <Field
          label="Tags, séparés par une virgule"
          name="tags"
          defaultValue={product?.tags.map((tag) => tag.name).join(', ')}
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
      <div className={styles.checks}>
        <Check name="featured" label="À la une" checked={product?.featured} />
        <Check
          name="newArrival"
          label="Nouveauté"
          checked={product?.newArrival}
        />
        <Check
          name="preorder"
          label="Précommande"
          checked={product?.preorder}
        />
      </div>
      <small>
        La visibilité dépend du statut de publication. La date éditoriale ne
        programme pas une mise en ligne.
      </small>
    </AdminForm>
  );
}
