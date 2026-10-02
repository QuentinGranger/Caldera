import Link from 'next/link';
import { ProductLanguage } from '@/generated/prisma/client';
import { saveVariantAction } from '@/lib/admin/actions';
import { euros, formatDate, label } from '@/lib/admin/format';
import { landedCost } from '@/lib/finance/landedCost';
import { AdminForm } from './AdminForm';
import { Field, SelectField, Check, Hidden } from './AdminFields';
import { AdminTable, IntegrityWarning } from './AdminUI';
import { StockAdjustmentForms } from './StockAdjustmentForms';
import type { AdminProduct } from './ProductInformationForm';
import styles from './Admin.module.scss';
type Variant = AdminProduct['variants'][number];
export function VariantEditor({
  productId,
  variant,
}: {
  productId: string;
  variant?: Variant;
}) {
  const currentLandedCost = variant
    ? landedCost({
        costPrice: variant.costPrice,
        inboundShippingCost: variant.inboundShippingCost,
        procurementFees: variant.procurementFees,
      })
    : null;
  const currentMarginRate =
    variant && currentLandedCost && variant.price.gt(0)
      ? variant.price.minus(currentLandedCost).div(variant.price).mul(100)
      : null;

  return (
    <>
      <AdminForm
        action={saveVariantAction}
        submit={variant ? 'Enregistrer la variante' : 'Créer la variante'}
        confirm={
          variant?.isActive
            ? 'Cette variante ne sera plus proposée à la vente. Les commandes existantes restent intactes.'
            : undefined
        }
        confirmWhen="inactive"
      >
        <Hidden name="productId" value={productId} />
        {variant && (
          <>
            <Hidden name="id" value={variant.id} />
            <Hidden name="version" value={variant.updatedAt.toISOString()} />
          </>
        )}
        <div className={styles.fields}>
          <Field
            label="SKU"
            name="sku"
            defaultValue={variant?.sku}
            required
            maxLength={100}
          />
          <Field
            label="Code-barres / EAN"
            name="barcode"
            defaultValue={variant?.barcode ?? ''}
            maxLength={100}
          />
          <SelectField
            label="Langue"
            name="language"
            defaultValue={variant?.language ?? 'FR'}
          >
            {Object.values(ProductLanguage).map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </SelectField>
          <SelectField label="État" name="condition" defaultValue="NEW">
            <option value="NEW">Neuf</option>
          </SelectField>
          <Field
            label="Prix (€)"
            name="price"
            inputMode="decimal"
            required
            defaultValue={variant?.price.toFixed(2) ?? '0.00'}
          />
          <Field
            label="Ancien prix (€)"
            name="compareAtPrice"
            inputMode="decimal"
            defaultValue={variant?.compareAtPrice?.toFixed(2) ?? ''}
          />
          <Field
            label="Coût d’achat unitaire (€), interne"
            name="costPrice"
            inputMode="decimal"
            defaultValue={variant?.costPrice?.toFixed(2) ?? ''}
          />
          <Field
            label="Transport fournisseur / unité (€)"
            name="inboundShippingCost"
            inputMode="decimal"
            required
            defaultValue={variant?.inboundShippingCost.toFixed(2) ?? '0.00'}
          />
          <Field
            label="Autres frais d’approvisionnement / unité (€)"
            name="procurementFees"
            inputMode="decimal"
            required
            defaultValue={variant?.procurementFees.toFixed(2) ?? '0.00'}
          />
          <Field
            label="Seuil de stock faible"
            name="lowStockThreshold"
            type="number"
            min={0}
            max={1000000}
            required
            defaultValue={variant?.lowStockThreshold ?? 2}
          />
          <Field
            label="Poids (g)"
            name="weightGrams"
            type="number"
            min={0}
            max={1000000}
            defaultValue={variant?.weightGrams ?? ''}
          />
          {!variant && (
            <Field
              label="Stock physique initial"
              name="stockQuantity"
              type="number"
              min={0}
              max={1000000}
              required
              defaultValue={0}
            />
          )}
        </div>
        <p className={styles.muted}>
          Coût rendu = achat + transport fournisseur par unité + autres frais
          d’approvisionnement.
          {currentLandedCost && (
            <>
              {' '}Actuel : <strong>{euros(currentLandedCost)}</strong>
              {currentMarginRate && (
                <> · marge brute théorique : <strong>{currentMarginRate.toFixed(1)} %</strong></>
              )}
            </>
          )}
        </p>
        <div className={styles.checks}>
          <Check
            name="isActive"
            label="Variante active"
            checked={variant?.isActive ?? true}
          />
          <Check
            name="isDefault"
            label="Variante par défaut"
            checked={variant?.isDefault}
          />
        </div>
      </AdminForm>
      {variant && (
        <>
          <hr />
          <h3>Stock et réservations</h3>
          <p>
            Physique : <strong>{variant.stockQuantity}</strong> · Réservé :{' '}
            <strong>{variant.reservedQuantity}</strong> · Disponible :{' '}
            <strong>{variant.availableQuantity}</strong>
          </p>
          {(variant.reservedQuantity < 0 ||
            variant.stockQuantity < variant.reservedQuantity) && (
            <IntegrityWarning>
              Incohérence de stock. Une vérification technique est nécessaire.
            </IntegrityWarning>
          )}
          <StockAdjustmentForms
            variantId={variant.id}
            stock={variant.stockQuantity}
          />
          <h3>Réservations actives</h3>
          {variant.reservations.length ? (
            <ul>
              {variant.reservations.map((reservation) => (
                <li key={reservation.id}>
                  <Link href={`/admin/commandes/${reservation.order.id}`}>
                    {reservation.order.orderNumber}
                  </Link>{' '}
                  · {reservation.quantity} unité(s) · expiration{' '}
                  {formatDate(reservation.expiresAt)}
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucune réservation active.</p>
          )}
          <h3>10 derniers ajustements</h3>
          {variant.adjustments.length ? (
            <AdminTable
              caption="Historique du stock"
              headings={[
                'Date / auteur',
                'Nature / motif',
                'Avant',
                'Variation',
                'Après',
              ]}
            >
              {variant.adjustments.map((adjustment) => (
                <tr key={adjustment.id}>
                  <td>
                    {formatDate(adjustment.createdAt)}
                    <small>{adjustment.adminUser.name}</small>
                  </td>
                  <td>
                    {label(adjustment.type)}
                    <small>{adjustment.reason}</small>
                  </td>
                  <td>{adjustment.previousQuantity}</td>
                  <td>
                    {adjustment.quantityDelta > 0 ? '+' : ''}
                    {adjustment.quantityDelta}
                  </td>
                  <td>{adjustment.newQuantity}</td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <p>Aucun ajustement administratif.</p>
          )}
        </>
      )}
    </>
  );
}
