import Image from 'next/image';
import {
  uploadImageAction,
  editImageAction,
  deleteImageAction,
} from '@/lib/admin/actions';
import { AdminForm } from './AdminForm';
import { Check, Field, Hidden } from './AdminFields';
import type { AdminProduct } from './ProductInformationForm';
import styles from './Admin.module.scss';
export function ImageManager({ product }: { product: AdminProduct }) {
  return (
    <>
      <p>
        JPEG, PNG ou WebP · 5 Mo maximum. Les images sont réencodées en WebP.
      </p>
      <div className={styles.imageGrid}>
        {product.images.map((image) => (
          <article className={styles.card} key={image.id}>
            <Image
              src={image.url}
              alt={image.alt || product.name}
              width={240}
              height={200}
            />
            <AdminForm action={editImageAction} submit="Enregistrer l’image">
              <Hidden name="id" value={image.id} />
              <Hidden name="productId" value={product.id} />
              <Field
                label="Texte alternatif"
                name="alt"
                defaultValue={image.alt}
                maxLength={300}
              />
              <Field
                label="Ordre"
                name="sortOrder"
                type="number"
                min={0}
                max={1000000}
                defaultValue={image.sortOrder}
                required
              />
              <div className={styles.checks}>
                {image.isPrimary ? (
                  <>
                    <Hidden name="isPrimary" value="on" />
                    <p>Image principale</p>
                  </>
                ) : (
                  <Check
                    name="isPrimary"
                    label="Définir comme image principale"
                  />
                )}
              </div>
            </AdminForm>
            <AdminForm
              action={deleteImageAction}
              submit="Retirer l’image"
              confirm="Retirer cette image du produit ? Les commandes historiques conserveront leur visuel."
            >
              <Hidden name="id" value={image.id} />
              <Hidden name="productId" value={product.id} />
            </AdminForm>
          </article>
        ))}
      </div>
      <details open={!product.images.length}>
        <summary>Ajouter une image</summary>
        <AdminForm action={uploadImageAction} submit="Téléverser">
          <Hidden name="productId" value={product.id} />
          <div className={styles.fields}>
            <Field
              label="Fichier image"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
            <Field
              label="Texte alternatif"
              name="alt"
              maxLength={300}
              placeholder={product.name}
            />
          </div>
        </AdminForm>
      </details>
    </>
  );
}
