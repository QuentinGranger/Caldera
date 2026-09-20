import { adjustStockAction } from '@/lib/admin/actions';
import { AdminForm } from './AdminForm';
import { Field, Hidden, SelectField } from './AdminFields';
import styles from './Admin.module.scss';
export function StockAdjustmentForms({
  variantId,
  stock,
}: {
  variantId: string;
  stock: number;
}) {
  return (
    <div className={styles.grid}>
      <details>
        <summary>Réapprovisionner / ajuster</summary>
        <AdminForm
          action={adjustStockAction}
          submit="Appliquer l’ajustement"
          confirm="Confirmez la quantité et le motif. Cet ajustement sera conservé dans l’historique."
        >
          <Hidden name="variantId" value={variantId} />
          <Hidden name="mode" value="delta" />
          <div className={styles.fields}>
            <SelectField label="Nature" name="type" defaultValue="RESTOCK">
              <option value="RESTOCK">Réapprovisionnement (+)</option>
              <option value="DAMAGE">Dommage (−)</option>
              <option value="LOSS">Perte (−)</option>
              <option value="RETURN">Retour (+)</option>
              <option value="MANUAL">Manuel (+ / −)</option>
            </SelectField>
            <Field
              label="Quantité à ajouter / retirer"
              name="quantity"
              type="number"
              required
              min={-1000000}
              max={1000000}
              step={1}
              placeholder="Ex. 12 ou -2"
            />
            <div className={styles.full}>
              <Field label="Motif" name="reason" required maxLength={500} />
            </div>
          </div>
        </AdminForm>
      </details>
      <details>
        <summary>Corriger le stock physique</summary>
        <AdminForm
          action={adjustStockAction}
          submit="Corriger le stock"
          confirm="Vous allez mettre le stock physique à zéro. Les réservations existantes restent protégées."
          confirmWhen="stockZero"
        >
          <Hidden name="variantId" value={variantId} />
          <Hidden name="mode" value="absolute" />
          <Hidden name="type" value="CORRECTION" />
          <Hidden name="expected" value={stock} />
          <div className={styles.fields}>
            <Field
              label="Nouveau stock physique"
              name="quantity"
              type="number"
              required
              min={0}
              max={1000000}
              step={1}
              defaultValue={stock}
            />
            <Field
              label="Motif de correction"
              name="reason"
              required
              maxLength={500}
            />
          </div>
          <small>
            Si le stock a changé entre-temps, l’enregistrement sera refusé.
          </small>
        </AdminForm>
      </details>
    </div>
  );
}
